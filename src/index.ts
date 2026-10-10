import { DurableObject } from "cloudflare:workers";

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
}

// One instance per room. Uses WebSocket hibernation so idle rooms are not billed for duration.
export class GameRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(sender: WebSocket, message: string | ArrayBuffer): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== sender) ws.send(message);
    }
  }

  webSocketClose(ws: WebSocket, code: number): void {
    ws.close(code);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const match = new URL(request.url).pathname.match(/^\/ws\/([\w-]{1,64})$/);
    if (!match) return new Response("Not found", { status: 404 });
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(match[1]));
    return stub.fetch(request);
  },
};
