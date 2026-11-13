# Backlog: v2 candidates, known issues, and bugs

The working list for after Phase 1. Nothing here is approved scope until it lands in a spec
(`docs/spec.md` is frozen for Phase 1; v2 gets its own spec). Log decisions in `docs/decisions.md`.

## Bugs and changes (things that don't work as expected)

Add one line each: date, what happened, device and browser, link or game id if any.

| Date | Report | Device | Status |
|---|---|---|---|
| 2026-11-13 | Owner's phone-test results: to be added after the next deployment (B1 and B2 were not specifically tested) | — | Pending |
| 2026-11-13 | B1 (High): turn freezes after a shot is lost on a dead socket; Fire stays disabled until reload. First reported 2026-10-12 | iOS after lock screen (by code reading, not reproduced on a device) | Open; PR `fix/lost-shot-freeze` |
| 2026-11-13 | S1 (Medium): no limits on WebSocket connects, sockets per game or message rate | Worker (code reading) | Open; PR `fix/ws-abuse-limits` |
| 2026-11-13 | B2 (Medium): guest seat is claimed on page load with no tap and locked to that browser's storage | Any browser (code reading, not reproduced) | Held for owner decision D3 |
| 2026-11-13 | B3 (Medium): wake lock can be acquired after release and never let go. First reported 2026-10-12 | Browsers with Screen Wake Lock (code reading) | Open; PR `fix/wakelock-race` |
| 2026-11-13 | G1 (Medium): no end-of-game reveal or board review; game-over dialog cannot be dismissed | Any | v2 proposal (needs a spec change) |
| 2026-11-13 | G2 (Medium): no way out of an abandoned game (forfeit, resign, turn timer, claim-win) | Any | v2 proposal |
| 2026-11-13 | P2 (Medium): staging E2E gate that blocks production looks flaky; unmerged patch on `origin/copilot/fix-failing-github-actions-job` | CI | Held for owner OK (row 10) |
| 2026-11-13 | L2 (Low): sunk reveal draws ship boundaries when ships touch (reproduced against the engine) | Any | Owner decision D2: keep for now; v2 proposal |
| 2026-11-13 | L3 (Low): frozen spec section 3 still says "hit (with ship name)"; decision 2026-10-22 overrides it | Docs | Held for owner decision D4 |
| 2026-11-13 | L4 (Low): no browser test guards the hit-identity fix | E2E | Open; PR `test/hit-identity-guard` |
| 2026-11-13 | S2 (Low): per-IP create limit bypassable over IPv6. First reported 2026-10-12 | Worker | Open; PR `fix/api-input-hardening` |
| 2026-11-13 | S3 (Low): `POST /api/games` with body `null` returns 500. First reported 2026-10-12 | Worker | Open; PR `fix/api-input-hardening` |
| 2026-11-13 | S4 (Low): no security headers (CSP, nosniff, referrer, frame rules) | Static assets | Open; PR `chore/security-headers` |
| 2026-11-13 | S5 (Low): game creation accepts cross-site requests | Worker | Open; PR `fix/api-input-hardening` |
| 2026-11-13 | S6 (Low): finished games and per-IP limiter objects are never cleaned up | Durable Objects | v2 proposal |
| 2026-11-13 | S7 (Low): Actions referenced by tag, not commit SHA, in jobs holding the Cloudflare token | CI | Held for owner OK (row 10) |
| 2026-11-13 | B4 (Low): computer's opening shot plays on the placement screen and briefly re-enables Ready | Any, vs computer | Open; PR `fix/client-small` |
| 2026-11-13 | B5 (Low): a replaced socket can still deliver messages, so a result can be applied twice | Any | Open; PR `fix/lost-shot-freeze` |
| 2026-11-13 | B6 (Low): a mistyped game link shows "Connecting" forever instead of "No game here" | Any | Open; PR `fix/client-small` |
| 2026-11-13 | B7 (Low): an unfinished fleet layout is lost on reload or iOS tab eviction | iOS | v2 proposal (new behaviour) |
| 2026-11-13 | B8 (Low): client fleet copy can drift from engine rules unnoticed. First reported 2026-10-12 | Code | Open; PR `fix/client-small` |
| 2026-11-13 | G3 (Low): no rematch. G4 (Low): no in-app rules or help | Any | Out of scope by spec; v2 proposal |
| 2026-11-13 | P3 (Low): pull requests run only typecheck and unit tests; E2E runs after merge | CI | By decision 2026-10-10; held for owner OK (row 10) |
| 2026-11-13 | L5 (Info): sunk list is ordered by the opponent's placement order | Server | Open; PR `test/hit-identity-guard` |
| 2026-11-13 | B9 (Info): duplicate branch in `tapPlacement`, mute listeners accumulate, `is-firing` never cleared | Client | Open; PR `fix/client-small` |
| 2026-11-13 | P5 (Info): acceptance criteria 8 and 9 (real iPhone install, previews, two-phone game) still unticked | Owner | Owner to-do (see the 2026-10-10 handoff) |

Findings above come from the 2026-11-13 review (full report not committed; owner's choice) and the
2026-10-12 review (`docs/triage/2026-10-12-code-review.md`). Only L2 and L5 have been reproduced so far.
Each fix PR reproduces its bug first and updates this table. P1 (the stranded 2026-10-12 review) is closed
by this change; P4 (stale local clone) is moot, the review's line numbers were re-checked after `git fetch`.

## Known issues and gaps in Phase 1

| Issue | Impact | Suggested fix |
|---|---|---|
| Press Start 2P font not bundled | Arcade titles use system monospace | Owner supplies `public/fonts/press-start-2p.woff2`, then the `@font-face` rule in `tokens.css` is enabled by regenerating it from the design system |
| Phones narrower than 360px (iPhone SE 1st gen) scroll sideways | Small | Design-system decision: allow cells under 32px, or accept |
| Expiry (24h) verified by unit test only | Low | Optional: a staging test with a shortened `EXPIRY_MS` |
| Dead-socket probe after lock screen tested in desktop WebKit only | Real iOS behaviour unverified | Owner's real-iPhone lock/return test |
| OG image URL is absolute to production, including on staging | Staging previews show production's image (same file) | Fine unless the images diverge |
| Finished and expired game records are never deleted | Negligible storage (under 2 KB per game) | Optional cleanup alarm after N days |
| Wide (tablet/desktop) battle layout has empty space under the boards | Cosmetic | Design pass for 768px and wider |
| Placement screen: tapping your selected ship deselects it; no drag | By spec (no drag-and-drop) | Revisit after real-phone feedback |

## v2 candidates

From spec section 12 (Phase 2 backlog). The engine is open for these via `RulesConfig`:

- **Barrage:** a limited-use multi-shot where each surviving ship fires one missile in the same turn.
  Open question: a shared pool of 2 per player, or per ship.
- **Hidden sinking:** the defender does not announce a sunk ship. Open question: always on, or a one-time ability.
  Note: the sunk wreck reveal (`sunkCells`) and the AI's use of ship names would change.
- **Easy and medium AI** plus a difficulty selector. Hard AI lives in `src/engine/ai.ts`.

Other ideas surfaced during the build (not requested; for the owner to accept or drop):

- Rematch or "play again with the same friend". This was deliberately out of Phase 1 ("one link is one game").
- In-game rules or help sheet (the design system already has `nt-legend`).
- Opponent-left handling beyond the toast (for example, claim a win after a long absence).
- Offline shell via a service worker (not needed for install).
