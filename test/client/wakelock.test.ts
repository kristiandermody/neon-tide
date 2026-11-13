import { test } from "node:test";
import assert from "node:assert/strict";

// B3: keepAwake(false) while the wake lock request is still pending must not leave the lock held.

type Sentinel = { released: number; release: () => Promise<void>; addEventListener: (type: string, fn: () => void) => void };

function setup() {
  const listeners: Record<string, Array<() => void>> = {};
  const pending: Array<(s: Sentinel) => void> = [];
  let requests = 0;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      visibilityState: "visible",
      addEventListener: (type: string, fn: () => void) => (listeners[type] ??= []).push(fn),
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      wakeLock: {
        request: () => {
          requests++;
          return new Promise<Sentinel>((resolve) => pending.push(resolve));
        },
      },
    },
  });
  /** Resolve the oldest pending request with a new sentinel. */
  const grant = async () => {
    const sentinel: Sentinel = {
      released: 0,
      release: async () => {
        sentinel.released++;
      },
      addEventListener: () => {},
    };
    pending.shift()!(sentinel);
    await new Promise((r) => setImmediate(r));
    return sentinel;
  };
  return { listeners, grant, requests: () => requests };
}

let n = 0;
const load = async () =>
  (await import(new URL(`../../public/js/wakelock.js?t=${++n}`, import.meta.url).href)) as { keepAwake: (on: boolean) => void };

test("a lock that arrives after keepAwake(false) is released at once", async () => {
  const env = setup();
  const { keepAwake } = await load();
  keepAwake(true); // request is now pending
  keepAwake(false); // game over before the browser answered
  const sentinel = await env.grant();
  assert.equal(sentinel.released, 1, "the unwanted lock was released");
});

test("a visibility change during a pending request does not request a second lock", async () => {
  const env = setup();
  const { keepAwake } = await load();
  keepAwake(true);
  for (const fn of env.listeners["visibilitychange"] ?? []) fn();
  assert.equal(env.requests(), 1, "one request in flight");
  const sentinel = await env.grant();
  assert.equal(sentinel.released, 0, "the wanted lock is kept");
  keepAwake(false);
  assert.equal(sentinel.released, 1, "and released when no longer wanted");
});
