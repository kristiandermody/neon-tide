// Abuse limits for the WebSocket side (S1). Pure helpers so they can be unit tested without a runtime.

/** Sockets one game accepts at once. A normal game needs 2-4 (a player's replaced socket lingers briefly). */
export const MAX_SOCKETS_PER_GAME = 16;

/**
 * Messages one socket may send per window. A normal game sends a handful in total
 * (join/resume, place, ready, one fire per turn); keep-alive pings never reach the code.
 */
export const MESSAGE_BUDGET = 30;
export const MESSAGE_WINDOW_MS = 10_000;

/** WebSocket upgrades one IP may attempt per window, counted before any game object is reached. */
export const UPGRADE_LIMIT = 200;
export const UPGRADE_WINDOW_MS = 10 * 60 * 1000;

/** Application close code (4000-4999) sent when a socket exceeds its budget. */
export const CLOSE_RATE_LIMITED = 4429;

/** Fixed-window counter, small enough to live in the socket's attachment (16 KiB max). */
export interface Budget {
  /** Window start, ms since the epoch. */
  s: number;
  /** Messages seen in this window. */
  n: number;
}

/** Counts one message. Returns the budget to store and whether the message is within it. */
export function spendMessage(budget: Budget | undefined, now: number): { budget: Budget; allowed: boolean } {
  const fresh = !budget || now - budget.s >= MESSAGE_WINDOW_MS || now < budget.s;
  const next: Budget = fresh ? { s: now, n: 1 } : { s: budget.s, n: budget.n + 1 };
  return { budget: next, allowed: next.n <= MESSAGE_BUDGET };
}
