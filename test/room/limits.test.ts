import { test } from "node:test";
import assert from "node:assert/strict";
import { MESSAGE_BUDGET, MESSAGE_WINDOW_MS, spendMessage, type Budget } from "../../src/room/limits.ts";

function spendMany(n: number, now: number, start?: Budget): { budget: Budget; allowed: boolean[] } {
  let budget = start;
  const allowed: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const r = spendMessage(budget, now);
    budget = r.budget;
    allowed.push(r.allowed);
  }
  return { budget: budget!, allowed };
}

test("a socket may send MESSAGE_BUDGET messages per window, then is refused", () => {
  const { allowed } = spendMany(MESSAGE_BUDGET + 5, 1000);
  assert.equal(allowed.filter(Boolean).length, MESSAGE_BUDGET);
  assert.deepEqual(allowed.slice(MESSAGE_BUDGET), [false, false, false, false, false]);
});

test("the budget resets when the window has passed", () => {
  const first = spendMany(MESSAGE_BUDGET + 1, 1000);
  assert.equal(first.allowed.at(-1), false);
  const later = spendMessage(first.budget, 1000 + MESSAGE_WINDOW_MS);
  assert.equal(later.allowed, true);
  assert.deepEqual(later.budget, { s: 1000 + MESSAGE_WINDOW_MS, n: 1 });
});

test("a missing budget (first message) and a clock that went backwards both start a fresh window", () => {
  assert.deepEqual(spendMessage(undefined, 5), { budget: { s: 5, n: 1 }, allowed: true });
  assert.deepEqual(spendMessage({ s: 9000, n: 50 }, 100), { budget: { s: 100, n: 1 }, allowed: true });
});

test("normal play stays far inside the budget", () => {
  // join, place, ready, then a shot every 2 seconds for a 60-shot game, as seen in any one 10 s window.
  const { allowed } = spendMany(3 + 5, 0);
  assert.ok(allowed.every(Boolean));
});
