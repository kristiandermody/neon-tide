# Handoff: after the 2026-11-13 fix session

For the next agent or session working in this repo. No secrets. Read `CLAUDE.md`, `docs/spec.md`,
`docs/decisions.md`, `docs/backlog.md`, then this file. Companion: `docs/sessions/2026-11-13-fix-session-report.md`.

## State

- `main` is at `7e7deaf` plus whatever the owner has merged since. Nine pull requests are open (#18 to #26, listed in
  the report). **None is merged.** A merge to `main` deploys staging, runs smoke and E2E, then deploys production.
- The last Deploy of `main` failed at the staging E2E (iPhone two-player test). Production runs PR #15's code.
- Held rows from the 2026-11-13 work order:
  - **Row 3** (spec note for L3): needs the owner's yes on D4 before the frozen spec is edited.
  - **Row 4** (join on tap, B2): needs the owner's yes on D3; it changes the invite flow. Never reproduced on a device.
  - **Row 10** (CI): diagnose the iPhone friend-game hang, decide the Copilot patch (#17, which never ran CI), consider
    E2E on pull requests and pinning Actions to commit SHAs. Needs the owner's OK for the job and the pinning.
- Pending input: the owner's phone-test issues go into the `docs/backlog.md` bug table.

## Next steps, in order

1. Owner merges, suggested order: **#19** (the High bug) first, and watch that deploy's staging E2E; then the rest.
   After each merge, update the remaining branches with a merge from `main` (no force-push). Expect trivial conflicts at
   the end of `docs/decisions.md` in every pull request, and one in `src/index.ts` between #22 and #23: both build a
   limiter key, and whichever lands second should use `ws:${limitKey(ip)}`.
2. Check the iPhone (WebKit) results of the first staging E2E runs: #19, #20, #24 and #25 were only run on Chromium.
   If the CSP in #25 breaks WebKit, revert #25 or loosen the failing directive.
3. Row 10, after the owner's OK: raise or bypass the create limit for CI (the suite is near 20 per 10 minutes, see the
   report), then decide #17.
4. Add the owner's phone-test results to `docs/backlog.md`.
5. If the owner approves a v2 scope from `docs/spec-v2.md`, update `CLAUDE.md` first; until then Phase 1 only.

## Owner to-do

- [ ] Merge the pull requests (or tell the next agent to).
- [ ] Answer D3 (join on tap), D4 (spec note), and the CI question for row 10.
- [ ] Send the phone-test issues; test the lock-screen case (B1) on a real iPhone after #19 is live.
- [ ] Read `docs/spec-v2.md` and answer its decisions list.
- [ ] Still open from the 2026-10-10 handoff: real-iPhone install and previews (criterion 8), a two-iPhone game
      (criterion 9), the Press Start 2P font file, and rolling the Cloudflare CI token before 2027-01-08.

## Local setup notes

- `npm ci`, then `npm run dev` (port 8787) for E2E. The per-IP create limit (20 per 10 minutes) applies locally too:
  restart `wrangler dev` with a fresh `--persist-to` folder to clear it. Several runs in a row will trip it.
- The WebSocket upgrade limit added in #22 also counts per IP locally (200 per 10 minutes).
- Browser automation must stay muted (`e2e/fixtures.ts` does it; ad-hoc scripts need `--mute-audio` and
  `localStorage nt:muted=1`).
- If the pinned Playwright wants a Chromium build you do not have, use a local, uncommitted config that sets
  `launchOptions.executablePath`. Do not run `playwright install` blindly in a managed environment.

## Rules still in force

`CLAUDE.md` applies unchanged: feature branches and small pull requests, never commit to `main`, no force-push, no
deleting remote branches, no account setting changes, no secrets, verify Cloudflare and Playwright config against current
docs, stop after 3 failed gate attempts or before anything irreversible, and finish with the spec's section 13 report.
