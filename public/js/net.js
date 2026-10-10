// One WebSocket per game. Reconnects with backoff and resumes the seat with the same token.
const PING = '{"type":"ping"}';
const PING_EVERY_MS = 25000;
/** After a lock screen or app switch, a socket can report OPEN while dead (common on iOS). */
const PROBE_TIMEOUT_MS = 3000;

export class Connection {
  /**
   * @param {string} gameId
   * @param {string} token
   * @param {{ onMessage: (msg: any) => void, onStatus: (status: "connecting" | "open" | "closed") => void }} handlers
   */
  constructor(gameId, token, handlers) {
    this.gameId = gameId;
    this.token = token;
    this.handlers = handlers;
    this.ws = null;
    this.attempt = 0;
    this.seated = false;
    this.stopped = false;
    this.pingTimer = null;
    this.retryTimer = null;
    this.probeTimer = null;
    this.lastMessageAt = 0;
    this.connect();
  }

  connect() {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${scheme}://${location.host}/ws/${this.gameId}`);
    this.ws = ws;
    this.handlers.onStatus("connecting");

    ws.addEventListener("open", () => {
      this.attempt = 0;
      this.handlers.onStatus("open");
      ws.send(JSON.stringify({ type: this.seated ? "resume" : "join", token: this.token }));
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.ws === ws && ws.readyState === WebSocket.OPEN && ws.send(PING), PING_EVERY_MS);
    });
    ws.addEventListener("message", (event) => {
      this.lastMessageAt = Date.now();
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "pong") return;
      if (msg.type === "state") this.seated = true;
      if (msg.type === "error" && ["not_found", "game_full", "game_over", "expired", "not_a_player"].includes(msg.code)) this.stop();
      this.handlers.onMessage(msg);
    });
    ws.addEventListener("close", () => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws || this.stopped) return;
      this.handlers.onStatus("closed");
      const delay = Math.min(10000, 500 * 2 ** this.attempt++);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    });
  }

  /** Reconnect now (e.g. the page became visible again) unless a healthy socket is open. */
  wake() {
    if (this.stopped) return;
    const ws = this.ws;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      this.attempt = 0;
      this.connect();
      return;
    }
    if (ws.readyState !== WebSocket.OPEN) return;
    // Probe: any frame back within the timeout proves the socket is alive; otherwise replace it.
    const sentAt = Date.now();
    ws.send(PING);
    clearTimeout(this.probeTimer);
    this.probeTimer = setTimeout(() => {
      if (this.ws !== ws || this.stopped || this.lastMessageAt >= sentAt) return;
      this.ws = null;
      try {
        ws.close(4000, "stale");
      } catch {
        // already gone
      }
      this.attempt = 0;
      this.connect();
    }, PROBE_TIMEOUT_MS);
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  stop() {
    this.stopped = true;
    clearInterval(this.pingTimer);
    clearTimeout(this.probeTimer);
    clearTimeout(this.retryTimer);
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close(1000, "done");
  }
}
