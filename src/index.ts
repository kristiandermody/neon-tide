import { DurableObject } from "cloudflare:workers";
import { cryptoRng, other, type Seat } from "./engine/index.ts";
import { GAME_ID_PATTERN, newGameId } from "./room/ids.ts";
import { PING, PONG, TOKEN_PATTERN, parseClientMessage, type Mode, type ServerMessage } from "./room/protocol.ts";
import { claimSeat, createRoom, handle, stateFor, type RoomRecord } from "./room/room.ts";

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

/** One instance per game. WebSocket hibernation keeps idle games from being billed for duration. */
export class GameRoom extends DurableObject<Env> {
  private room: RoomRecord | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alive pings are answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  private load(): RoomRecord | undefined {
    this.room ??= this.ctx.storage.kv.get<RoomRecord>(ROOM_KEY);
    return this.room;
  }

  private save(room: RoomRecord): void {
    this.room = room;
    this.ctx.storage.kv.put(ROOM_KEY, room);
  }

  /** Called once by the Worker right after it picks a fresh id. */
  async init(id: string, mode: Mode, token: string): Promise<boolean> {
    if (this.load()) return false;
    this.save(createRoom(id, mode, token, Date.now(), cryptoRng));
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
      if (claim.joined) {
        room.updatedAt = Date.now();
        this.save(room);
      }
      this.sendTo(other(claim.seat), { type: "opponent_status", status: claim.joined ? "joined" : "connected" });
      this.broadcastState(room);
      return;
    }
    if (seat === null) {
      return send(ws, { type: "error", code: "not_joined", message: "Join the game first." });
    }

    const result = handle(room, seat, msg, Date.now(), cryptoRng);
    if (result.changed) this.save(room);
    for (const { to, msg: out } of result.out) this.sendTo(to, out);
    if (result.changed) this.broadcastState(room);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    ws.close(code, reason);
  }

  private sockets(seat: Seat): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attachment | null)?.seat === seat);
  }

  private connected(seat: Seat): boolean {
    return this.sockets(seat).length > 0;
  }

  private sendTo(seat: Seat, msg: ServerMessage): void {
    for (const ws of this.sockets(seat)) send(ws, msg);
  }

  private broadcastState(room: RoomRecord): void {
    for (const seat of [0, 1] as Seat[]) {
      const sockets = this.sockets(seat);
      if (sockets.length === 0) continue;
      const state = stateFor(room, seat, this.connected(other(seat)));
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
