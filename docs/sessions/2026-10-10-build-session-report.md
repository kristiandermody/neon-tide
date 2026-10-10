# Session report: Phase 1 build (2026-10-10)

The detailed record of the build session. The short version for resuming work is
`2026-10-10-build-session-handoff.md`. No secrets in this file.

## Summary

Starting from a Worker scaffold and an unmerged design-system branch, this session synced the repo,
added CI, then built and shipped all of Phase 1 in spec order. Every change went through its own
PR with green checks. All PRs from #3 to #13 are merged, and every deploy run on `main` succeeded.
The game is live on staging and production. It is not yet accepted: criteria 8 and 9 need the owner
on real phones.

## Chronology (times UTC)

| Time | PR | Branch | What happened |
|---|---|---|---|
| 16:00 | — | `feat/design-system-css` | Preflight. Pushed the unpushed design commit `38ec5a2` as a backup before anything else. |
| 16:06 | #3 | `docs/spec` | Spec, `CLAUDE.md`, decision log, build handoff (the owner's newer pasted version), `.claude/` ignored. |
| 16:07 | #4 | `feat/design-system-css` | Design system shipped unchanged. It passed the spec section 5 check. It was not rebased: that would have needed a force-push. |
| 16:09 | #5 | `ci/pr-checks-and-auto-prod` | `ci.yml` (typecheck and tests on PRs). Production deploys after staging. `actions/checkout@v7`, `actions/setup-node@v7`, Node 24. README. |
| 16:14 | #6 | `feat/engine` | Pure TypeScript engine, `RulesConfig`, hard probability AI (averages 44 shots to win over 300 games), 25 tests. |
| 16:29 | #7 | `feat/computer-mode` | `GameRoom` protocol (hibernation, auto-response ping, SQLite KV), `POST /api/games`, `CreateLimiter` DO (migration v2), SPA asset routing, full computer-mode UI. |
| 16:42 | #8 | `feat/two-player` | Friend games: invite screen (Web Share, Copy fallback), seat claiming, join broadcasts, two-seat leak test. |
| 16:54 | #9 | `feat/reconnect` | Alarm-driven 2-minute grace and 24h expiry, dead-socket probe on return, wake lock. Fixed the scaffold's `webSocketClose` bug. |
| 16:58 | #10 | `feat/pwa` | Manifest, icons (the sunk-cube glyph), safe-area insets, OG and Twitter tags, OG image. |
| 17:04 | #12 | `feat/e2e` | Playwright E2E (14 tests, iPhone WebKit and Pixel Chromium), `scripts/smoke.sh`. The deploy now gates production on staging smoke and E2E passing. |
| 17:05 | #11 | `docs/session-2026-10-10-sound-investigation` | (Separate session.) Found the source of the stray game sounds: this session's headless test browsers. |
| 17:10 | #13 | `fix/e2e-mute-audio` | Applied #11's fix: E2E contexts start muted, and Chromium runs with `--mute-audio`. |

## Problems hit and how they were resolved

1. **Rebase versus no force-push.** The handoff said to push the design branch first (as a backup)
   and then rebase it. A rebase of a pushed branch needs a force-push, which is forbidden. Since
   `main` had only gained docs, the PR merged cleanly without a rebase. Logged in the decision log.
2. **`webSocketClose` threw on codes 1005 and 1006** (bug inherited from the scaffold). Echoing
   `ws.close(code)` is invalid for reserved codes, so disconnect handling never ran. Found when the
   grace-period test failed and the `wrangler dev` log showed the errors. The echo was removed:
   compat date 2026-10-01 auto-replies to Close frames.
3. **Battle screen overflowed a 390x664 viewport.** Fixed by putting the mini board and both fleet
   trackers in one panel and setting `--board-chrome: 340px`. A later regression made the iPad
   layout 16px too wide; it came from safe-area padding overriding the wide gutter, and is fixed by
   applying side insets only under 768px.
4. **Game-over modal missing after reload.** It was skipped while the message queue was draining.
   It now opens when the queue empties, and the win/lose sound only plays on the final shot.
5. **Local E2E runs hit the create rate limit** (20 per IP per 10 minutes) after repeated manual
   testing. That is expected behaviour; restarted `wrangler dev` with fresh local state.
6. **Stray game sounds on the owner's machine.** Headless Playwright browsers play Web Audio once a
   click unlocks it. Diagnosed by a separate session (#11) and fixed in #13. Saved as a memory for
   future sessions.
7. **`gh pr checks` could not read check status** with the active token (GraphQL "Resource not
   accessible"). Worked around by watching runs with `gh run watch`.

## Verification at the end of the session

- `npm run typecheck`: three configs (worker, engine and unit tests with Node-only types, E2E with DOM). Pass.
- `npm test`: 38 unit tests. Pass. Covers placement, firing, hit/miss/sunk, win, the hard AI,
  protocol parsing, seats, the opponent-board leak (both modes), grace, expiry, and record upgrade.
- `npm run e2e` against staging in CI: 14 passed (2.3 minutes). Also passed locally against `wrangler dev`.
- `scripts/smoke.sh` on staging and production after every deploy: pass, including the WebSocket upgrade (101 with `--http1.1`).
- Manual checks:
  - Grace timing against `wrangler dev`: no notice at 30s, a notice at 2:00, and "connected" on resume.
  - Chromium DevTools protocol: zero manifest and installability errors on staging.
  - Production serves byte-identical `app.js` to staging and to local `main`.

## Acceptance criteria (spec section 10)

| # | Criterion | Status |
|---|---|---|
| 1 | Engine unit tests in plain Node | Pass |
| 2 | Full game against the computer at phone width | Pass (E2E) |
| 3 | Two clients finish a game over WebSocket via a shared link | Pass (E2E) |
| 4 | Opponent ship positions never sent to a client | Pass (unit tests, both modes) |
| 5 | Reconnect within grace resumes the same game | Pass (E2E tab close and reopen, manual grace timing) |
| 6 | Finished and expired links show the end state and cannot be replayed | Finished: E2E. Expired: unit test only (24h) |
| 7 | Playwright E2E passes against staging | Pass (runs on every deploy) |
| 8 | PWA installs on iPhone Safari; link previews render | **Owner to check on a real iPhone.** Chromium install check passes |
| 9 | Owner and cousin finish a game on real iPhones | **Owner** |
