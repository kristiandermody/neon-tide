import { test } from "node:test";
import assert from "node:assert/strict";

// B5: a socket the client has replaced must not deliver late frames into the game.

class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static all: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  private listeners = new Map<string, Array<(event: any) => void>>();
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.all.push(this);
  }
  addEventListener(type: string, fn: (event: any) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = FakeSocket.CLOSED;
  }
  emit(type: string, event: unknown = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.emit("open");
  }
  receive(msg: unknown) {
    this.emit("message", { data: JSON.stringify(msg) });
  }
}

test("frames from a replaced socket are ignored; the current socket still delivers", async () => {
  Object.assign(globalThis, { WebSocket: FakeSocket, location: { protocol: "https:", host: "example.test" } });
  const { Connection } = (await import(new URL("../../public/js/net.js", import.meta.url).href)) as { Connection: any };

  const received: any[] = [];
  const conn = new Connection("0123456789abcdef", "token", { onMessage: (m: any) => received.push(m), onStatus: () => {} });
  try {
    const [first] = FakeSocket.all;
    first.open();
    first.receive({ type: "state", n: 1 });
    assert.deepEqual(received.map((m) => m.n), [1]);

    // The client replaces the socket (stale probe or wake). The old one may still deliver a late frame.
    conn.connect();
    const second = FakeSocket.all[1];
    second.open();
    first.receive({ type: "result", n: 2 });
    assert.deepEqual(received.map((m) => m.n), [1], "late frame from the replaced socket is dropped");

    second.receive({ type: "state", n: 3 });
    assert.deepEqual(received.map((m) => m.n), [1, 3]);
  } finally {
    conn.stop();
  }
});
