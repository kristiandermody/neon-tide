import { DurableObject } from "cloudflare:workers";
import { cryptoRng, other, type Seat } from "./engine/index.ts";
import { GAME_ID_PATTERN, newGameId } from "./room/ids.ts";
import { PING, PONG, TOKEN_PATTERN, parseClientMessage, type Mode, type ServerMessage } from "./room/protocol.ts";
import { claimSeat, createRoom, handle, markBack, markGone, nextAlarm, stateFor, tick, upgrade, type RoomRecord } from "./room/room.ts";

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  CREATE_LIMITER: DurableObjectNamespace<CreateLimiter>;
}

/** Per-IP game creation limit. */
const CREATE_LIMIT = 20;
const CREATE_WINDOW_MS = 10 * 60 * 1000;

const ROOM_KEY = "room";

interface Attachment {
  seat: Seat | null;
}

/**
 * One instance per game. WebSocket hibernation keeps idle games from being billed for duration;
 * a single alarm drives the 2-minute disconnect grace and the 24h expiry.
 */
export class GameRoom extends DurableObject<Env> {
  private room: RoomRecord | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alive pings are answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  private load(): RoomRecord | undefined {
    if (!this.room) {
      const stored = this.ctx.storage.kv.get<RoomRecord>(ROOM_KEY);
      if (stored) this.room = upgrade(stored);
    }
    return this.room;
  }

  /** Persists the record and moves the alarm to the next pending deadline. */
  private async save(room: RoomRecord): Promise<void> {
    this.room = room;
    this.ctx.storage.kv.put(ROOM_KEY, room);
    const at = nextAlarm(room);
    if (at === null) await this.ctx.storage.deleteAlarm();
    else if ((await this.ctx.storage.getAlarm()) !== at) await this.ctx.storage.setAlarm(at);
  }

  /** Called once by the Worker right after it picks a fresh id. */
  async init(id: string, mode: Mode, token: string): Promise<boolean> {
    if (this.load()) return false;
    await this.save(createRoom(id, mode, token, Date.now(), cryptoRng));
    return true;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seat: null } satisfies Attachment);
    if (!this.load()) {
      send(server, { type: "error", code: "not_found", message: "No game at this link." });
      server.close(4404, "not found");
    }
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const room = this.load();
    const msg = parseClientMessage(raw);
    if (!room) return;
    if (!msg) return send(ws, { type: "error", code: "bad_message", message: "Message not understood." });

    const { seat } = ws.deserializeAttachment() as Attachment;
    if (msg.type === "join" || msg.type === "resume") {
      const claim = claimSeat(room, msg);
      if ("type" in claim) return send(ws, claim);
      ws.serializeAttachment({ seat: claim.seat } satisfies Attachment);
      const wasAway = room.expired ? false : markBack(room, claim.seat, Date.now());
      await this.save(room);
      if (claim.joined) this.sendTo(other(claim.seat), { type: "opponent_status", status: "joined" });
      else if (wasAway) this.sendTo(other(claim.seat), { type: "opponent_status", status: "connected" });
      this.broadcastState(room);
      return;
    }
    if (seat === null) {
      return send(ws, { type: "error", code: "not_joined", message: "Join the game first." });
    }

    const result = handle(room, seat, msg, Date.now(), cryptoRng);
    if (result.changed) await this.save(room);
    for (const { to, msg: out } of result.out) this.sendTo(to, out);
    if (result.changed) this.broadcastState(room);
  }

  // With compatibility_date >= 2026-04-07 the runtime answers Close frames itself
  // (web_socket_auto_reply_to_close); echoing close() would throw on codes like 1005/1006.
  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.dropped(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.dropped(ws);
  }

  /** Starts the grace period when a seat's last socket goes away. */
  private async dropped(ws: WebSocket): Promise<void> {
    const room = this.load();
    const seat = (ws.deserializeAttachment() as Attachment | null)?.seat ?? null;
    if (!room || seat === null) return;
    if (this.sockets(seat).some((other) => other !== ws)) return;
    markGone(room, seat, Date.now());
    await this.save(room);
  }

  async alarm(): Promise<void> {
    const room = this.load();
    if (!room) return;
    const { newlyAway, expired } = tick(room, Date.now());
    await this.save(room);
    for (const seat of newlyAway) this.sendTo(other(seat), { type: "opponent_status", status: "disconnected" });
    if (newlyAway.length || expired) this.broadcastState(room);
    if (expired) for (const ws of this.ctx.getWebSockets()) ws.close(4410, "expired");
  }

  private sockets(seat: Seat): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attachment | null)?.seat === seat);
  }

  private sendTo(seat: Seat, msg: ServerMessage): void {
    for (const ws of this.sockets(seat)) send(ws, msg);
  }

  private broadcastState(room: RoomRecord): void {
    for (const seat of [0, 1] as Seat[]) {
      const sockets = this.sockets(seat);
      if (sockets.length === 0) continue;
      const state = stateFor(room, seat);
      for (const ws of sockets) send(ws, state);
    }
  }
}

/** Sliding-window counter, one instance per client IP. */
export class CreateLimiter extends DurableObject<Env> {
  async take(now: number, limit: number, windowMs: number): Promise<boolean> {
    const recent = (this.ctx.storage.kv.get<number[]>("hits") ?? []).filter((t) => now - t < windowMs);
    const allowed = recent.length < limit;
    if (allowed) recent.push(now);
    this.ctx.storage.kv.put("hits", recent);
    return allowed;
  }
}

function send(ws: WebSocket, msg: ServerMessage): void {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // Socket already closing; the client resyncs with `resume` when it reconnects.
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

async function createGame(request: Request, env: Env): Promise<Response> {
  let body: { mode?: unknown; token?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const mode = body.mode;
  if ((mode !== "computer" && mode !== "friend") || typeof body.token !== "string" || !TOKEN_PATTERN.test(body.token)) {
    return json({ error: "bad_request" }, 400);
  }
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const limiter = env.CREATE_LIMITER.get(env.CREATE_LIMITER.idFromName(ip));
  if (!(await limiter.take(Date.now(), CREATE_LIMIT, CREATE_WINDOW_MS))) return json({ error: "rate_limited" }, 429);

  const id = newGameId();
  const created = await env.GAME_ROOM.get(env.GAME_ROOM.idFromName(id)).init(id, mode, body.token);
  if (!created) return json({ error: "conflict" }, 409);
  return json({ id }, 201);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/games") {
      return request.method === "POST" ? createGame(request, env) : json({ error: "method_not_allowed" }, 405);
    }
    const ws = pathname.match(/^\/ws\/([^/]+)$/);
    if (ws) {
      if (!GAME_ID_PATTERN.test(ws[1])) return new Response("Not found", { status: 404 });
      return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(ws[1])).fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
