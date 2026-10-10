# Handoff: Phase 1 build, and how to resume

Companion to `2026-10-10-build-session-report.md`. Read this first in the next session. No secrets.

## 1. Where we started

- `main` had only the Worker scaffold (a placeholder relay `GameRoom`) and the earlier session docs.
- The design system existed only on an unpushed local branch (`feat/design-system-css`, commit `38ec5a2`).
- The spec, `CLAUDE.md`, the decision log and the build handoff were untracked local files.
- CI deployed staging on push; production was a manual dispatch. There were no PR checks and no tests.

## 2. Where we ended

- **Phase 1 is built, merged and live**:
  - Production: https://neon-tide.kristiandermody.com
  - Staging: https://neon-tide-staging.kristian-dermody-personal-account.workers.dev
- **Repo:** `main` equals `origin/main`, the working tree is clean, and no local branches other than `main` are left.
- **Pipeline:**
  - Each PR runs typecheck and unit tests (`ci.yml`).
  - Each merge to `main` deploys staging, runs the curl smoke test and Playwright E2E against it,
    then deploys production and smoke-tests it (`deploy.yml`). Production never ships if staging E2E fails.
- **Acceptance:** criteria 1 to 7 pass. Criteria 8 and 9 need the owner on real iPhones (see the report).

### Code map

```
src/engine/          pure TS rules + hard AI (no Cloudflare imports); RulesConfig in rules.ts
src/room/            protocol.ts (messages), room.ts (seats, moves, grace/expiry), ids.ts
src/index.ts         Worker routes (/api/games, /ws/<id>), GameRoom DO, CreateLimiter DO
public/              index.html shell, css/ (design system, do not hand-edit tokens.css), js/ (client), icons, og.png
public/js/           app.js (screens), board.js, net.js (socket + reconnect), fleet.js, feedback.js (sound/vibration), wakelock.js, store.js
test/                unit tests (node --test, plain Node)
e2e/                 Playwright specs + fixtures.ts (starts every context muted)
scripts/smoke.sh     curl smoke test, incl. WebSocket 101
docs/                spec.md (frozen Phase 1), decisions.md, backlog.md (v2 + bugs), sessions/
```

## 3. How to resume

1. Read `CLAUDE.md`, `docs/spec.md`, `docs/decisions.md` (Phase 1 entries end at 2026-10-10), and `docs/backlog.md`.
2. `git fetch && git status -sb`, and confirm `main` equals `origin/main`.
3. **Before writing any code for v2:** the spec is frozen at Phase 1 and `CLAUDE.md` says to build
   Phase 1 only. The owner first writes or approves a v2 spec (for example `docs/spec-v2.md`), then updates `CLAUDE.md`.
   Bug fixes to Phase 1 behaviour are allowed now.
4. Local dev: `npm ci`, then `npm run dev` (port 8787). To run E2E locally: `npx playwright install chromium webkit`, then `npm run e2e`.
5. **Any browser automation must be muted.** Use `e2e/fixtures.ts`, or for ad-hoc scripts, `--mute-audio` plus
   `localStorage nt:muted=1`. Headless browsers are audible on the owner's Mac.
6. Repeated local game creation hits the per-IP limit (20 per 10 minutes). To clear it, restart `wrangler dev` with a fresh `--persist-to` folder.

## 4. Owner to-do

- [ ] On a real iPhone: open production in Safari, Share, Add to Home Screen, launch it, and play a computer game (criterion 8).
- [ ] Send a game link in iMessage and WhatsApp and check the preview card shows the Neon Tide image (criterion 8).
- [ ] Play a full friend game with your cousin on two iPhones (criterion 9). Try locking the phone mid-game and coming back.
- [ ] Log anything that misbehaves in `docs/backlog.md` under "Bugs and changes".
- [ ] Supply `public/fonts/press-start-2p.woff2` (SIL OFL 1.1), or approve fetching it from Google Fonts' GitHub.
- [ ] Optional: load the repo-scoped GitHub token for agent sessions. `gh` currently uses the broad keyring login.
- [ ] Roll the Cloudflare CI token before **2027-01-08**.
- [ ] Optional: delete the merged remote branches on GitHub, or turn on "Automatically delete head branches".
  (`CLAUDE.md` forbids the agent from deleting remote branches.)
