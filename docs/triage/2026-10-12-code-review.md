# Code review bug report: 2026-10-12

Scope: full read of `src/`, `public/js/`, `wrangler.jsonc` and `.github/workflows/`, checked against
`docs/spec.md` and `docs/decisions.md`. Reviewed at `main` @ `81d8b89`.

Verification at time of review:

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test` | pass (38/38) |
| E2E / real devices | not run for this review |

Findings come from reading the code. None has been reproduced on a device yet; the repro steps
below are how each one should show up.

## Summary

| # | Severity | Title | Location | Status |
|---|---|---|---|---|
| 1 | High | Player's turn freezes after a shot is lost on a dead socket | `public/js/app.js:626` | Open |
| 2 | Medium | Wake lock can be acquired after release and never let go | `public/js/wakelock.js:6` | Open |
| 3 | Low | `POST /api/games` with a non-object JSON body returns 500 | `src/index.ts:172` | Open |
| 4 | Low | Per-IP create limit is bypassable over IPv6 | `src/index.ts:182` | Open |
| 5 | Low | Client fleet copy can drift from engine rules unnoticed | `public/js/fleet.js:6` | Open |
| 6 | Nit | Duplicate branches in `tapPlacement` | `public/js/app.js:424` | Open |

Severity: **High** = a player can get stuck in a real game; **Medium** = visible misbehaviour, no
game impact; **Low** = edge case or hardening; **Nit** = code tidiness.

---

## 1. Player's turn freezes after a shot is lost on a dead socket

- **Severity:** High
- **Area:** client, battle screen
- **Files:** `public/js/app.js:229-232`, `:240-241`, `:288-291`, `:614`, `:617-633`; `public/js/net.js:92-98`

### What happens

The player taps Fire, and from then on the Fire button stays disabled and taps on the enemy grid do
nothing, even though the banner says "Your turn". The only way out is to reload the page.

### Repro (expected)

1. Start a game on an iPhone (vs. computer is enough).
2. On your turn, aim at a cell, then lock the phone for a minute or two.
3. Unlock and press Fire within about 3 seconds, before the stale-socket probe
   (`PROBE_TIMEOUT_MS`) replaces the socket.
4. The probe replaces the socket, the client resumes, and the `state` says it is still your turn.
5. Fire stays disabled and you can't aim.

Any socket that reports `OPEN` but is dead triggers the same failure. Decision log entry
2026-10-10 ("iOS can leave a dead socket reporting OPEN") says this is common on iOS.

### Root cause

`fire()` sets `this.firing = true` once `conn.send()` returns true. `Connection.send()` only checks
`readyState === OPEN`, so it returns true on a dead socket and the frame is lost. `firing` is cleared
only by:

- a `result` for the player's own shot (`applyResult`, `app.js:290`), or
- an `error` message (`app.js:241`).

Neither one arrives, because the server never got the shot. The reconnect brings a fresh `state`,
but `drain()` never touches `firing`, so:

- `renderBattle()` keeps `fireBtn.disabled = ... || this.firing` (`app.js:614`), and
- `aim()` returns early when `this.firing` is set (`app.js:619`).

The `is-firing` class added at `app.js:631` also stays on the cell.

### Suggested fix

Treat a reconnect as cancelling any shot that hasn't been answered. In `connectionStatus`:

```js
connectionStatus(status) {
  this.online = status === "open";
  if (status === "open" && this.firing) {
    this.firing = false;
    if (this.target !== null) this.enemyBoard?.cells[this.target].classList.remove("is-firing");
  }
  if (this.kind === "battle") this.renderBattle();
}
```

You could clear it on every `state` instead, but a `state` from some unrelated event can arrive while
a shot is still in flight. That would let the player fire twice (the server would reject the second
shot, so it's harmless but noisy). Clearing on reconnect covers exactly the case where the shot was lost.

### Test

E2E: on your turn, make the socket drop the outgoing `fire` frame and then close (for example with
`page.routeWebSocket`, or by closing the socket through a test hook after the send). After the
reconnect, check that Fire becomes usable again and a second shot lands.

---

## 2. Wake lock can be acquired after release and never let go

- **Severity:** Medium
- **Area:** client, wake lock
- **File:** `public/js/wakelock.js:6-27`

### What happens

The screen stays awake after the game is over, on the game-over modal or after "New game" on the
home screen. It only dims once the page is hidden.

### Repro (expected)

1. Finish a game.
2. Reload the finished game's link (`/g/<id>`).
3. The `GameScreen` constructor calls `keepAwake(true)`. The first `state` has `phase: "over"`, so
   `render()` → `finish()` → `keepAwake(false)` runs almost at once.
4. The screen no longer auto-dims.

### Root cause

`acquire()` awaits `navigator.wakeLock.request("screen")`, and `sentinel` stays `null` until that
finishes. If `keepAwake(false)` runs during the await, it sets `wanted = false` but there is no
sentinel yet to release. Then the request finishes, stores the sentinel and holds the lock with
nobody wanting it.

There is a related race: two `acquire()` calls during the same await (the `visibilitychange`
listener plus a `keepAwake(true)`) both pass the `!sentinel` check. Both then request a lock, and
the first sentinel is overwritten and leaked.

### Suggested fix

```js
let pending = false;

async function acquire() {
  if (!wanted || sentinel || pending || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
  pending = true;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (!wanted) {
      lock.release().catch(() => {});
      return;
    }
    sentinel = lock;
    lock.addEventListener("release", () => {
      if (sentinel === lock) sentinel = null;
    });
  } catch {
    // Not allowed right now; try again on the next visibility change.
  } finally {
    pending = false;
  }
}
```

### Test

Manual: on Android Chrome, reload a finished game link and check that the screen dims after the
normal timeout. Unit-testing this would mean stubbing `navigator.wakeLock` with a deferred promise.

---

## 3. `POST /api/games` with a non-object JSON body returns 500

- **Severity:** Low
- **Area:** Worker API
- **File:** `src/index.ts:171-181`

### What happens

```sh
curl -X POST "$URL/api/games" -H 'content-type: application/json' -d 'null'
# 500 Internal Server Error (expected 400 {"error":"bad_request"})
```

`-d '42'` and `-d '"x"'` do the same thing in theory: `body.mode` on a number or string
is just `undefined`, so they get a 400. Only `null` throws.

### Root cause

`request.json()` succeeds and returns `null`. The next line reads `body.mode`, which throws
`TypeError`, and the Worker turns that into a 500.

### Suggested fix

```ts
let body: unknown;
try {
  body = await request.json();
} catch {
  return json({ error: "bad_request" }, 400);
}
if (!body || typeof body !== "object") return json({ error: "bad_request" }, 400);
const { mode, token } = body as { mode?: unknown; token?: unknown };
```

### Test

Add a case to `scripts/smoke.sh`'s API guard checks: POST `null`, expect 400.

---

## 4. Per-IP create limit is bypassable over IPv6

- **Severity:** Low (hardening)
- **Area:** Worker API, rate limiting
- **File:** `src/index.ts:182-184`

### What happens

The `CreateLimiter` is keyed on the exact `CF-Connecting-IP`. One IPv6 subscriber usually has a
whole /64 (2^64 addresses), so a client that rotates source addresses gets a fresh 20-per-10-minutes
allowance for each address. That works out to unlimited game creation. Each bypass also creates a new
`CreateLimiter` object with its own stored data.

### Suggested fix

Group IPv6 addresses by their /64 prefix before building the limiter key, for example:

```ts
function limitKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  // Expand :: then keep the first four hextets (/64).
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
  return full.slice(0, 4).join(":") + "::/64";
}
```

Log this as a decision. The spec only asks for "basic per-IP limit", so this tightens it on purpose.

### Test

Unit-test `limitKey` with full, compressed and IPv4 addresses.

---

## 5. Client fleet copy can drift from engine rules unnoticed

- **Severity:** Low (maintenance)
- **Area:** client placement / engine
- **Files:** `public/js/fleet.js:4-12`, `src/engine/rules.ts:19-29`

### What happens

Decision log entry 2026-10-10 deliberately keeps a client copy of the fleet geometry so the client
needs no build step. Nothing checks that the two copies match. If a ship's id, name or length changes
in one place only, these break quietly:

- placement previews and Randomize produce fleets the server rejects (`wrong_fleet` / `out_of_bounds`), and
- the fleet trackers and toasts show the wrong names or pip counts.

### Suggested fix

Add a unit test that imports both and compares them:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSIC_RULES } from "../src/engine/index.ts";
import { FLEET, SIZE } from "../public/js/fleet.js";

test("client fleet copy matches the engine rules", () => {
  assert.equal(SIZE, CLASSIC_RULES.size);
  assert.deepEqual(FLEET, CLASSIC_RULES.fleet.map((s) => ({ ...s })));
});
```

`fleet.js` has no DOM dependencies, so it imports cleanly in Node. `tsconfig.test.json` may need
`allowJs` or a `// @ts-expect-error` on the import.

---

## 6. Duplicate branches in `tapPlacement`

- **Severity:** Nit
- **File:** `public/js/app.js:424-425`

```js
if (owner && owner !== selected) return this.select(owner);
if (owner && owner === selected) return this.select(owner);
```

Both branches do the same thing. Collapse them to `if (owner) return this.select(owner);`. Behaviour
doesn't change: tapping your selected ship still deselects it, which is listed as by design in
`docs/backlog.md`.

---

## Checked and found correct

So these aren't checked again in the next review:

- **No board leaks:** `stateFor` and `resultFor` only expose shot results, ship names on hits, and
  the cells of sunk ships (decision 2026-10-10). The opponent's `fleet` is never serialized.
- **Concurrency:** each game object handles one message at a time, so `webSocketMessage`, `alarm`
  and `webSocketClose` can't interleave in ways that corrupt the room record.
- **Grace and expiry:** one alarm covers both deadlines (`nextAlarm`). A reconnect inside the grace
  period never notifies the opponent. Finished games clear the alarm and never expire.
- **Multiple sockets per seat:** `dropped()` only starts the grace period when the seat's last socket
  closes, and a replaced socket's late close is ignored.
- **Computer turn:** the computer doesn't fire after the player's winning shot (checks `phase`).
- **Rate-limit storage:** the hit list is capped at `CREATE_LIMIT` entries per IP.
- **IDs and tokens:** game ids are 80 random bits and seat tokens 128 bits, both from
  `crypto.getRandomValues`. Nobody can pass for the `COMPUTER` seat token because real tokens are hex-only.
- **Message validation:** `parseClientMessage` caps frames at 4 KB and placements at 20 entries, and
  checks the shape of every field.
- **Leftover `is-firing` class** (normal flow): it stays on fired cells but has no visible effect,
  because the later `is-flipping::before` rule wins the cascade. It's only worth clearing as part of fix #1.
