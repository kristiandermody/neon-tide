# Session report: 2026-11-13 review fixes

Work order: the 2026-11-13 review handoff (not committed, by the owner's choice). Findings are summarised in
`docs/backlog.md`. Every pull request below is open and unmerged; merging to `main` deploys.

## Outcome

Nine pull requests, one per row, each on its own branch from `main` at `7e7deaf`. Each reproduced its bug (or proved
its guard) before the fix, and each ran typecheck, unit tests and the full E2E suite against local `wrangler dev`.

| Row | PR | Branch | Covers | State |
|---|---|---|---|---|
| 0 | #18 | `docs/review-2026-11-13` | P1, P4, P5: 2026-10-12 review landed, backlog table filled | open |
| 1 | #19 | `fix/lost-shot-freeze` | B1 (High), B5 | open |
| 2 | #20 | `test/hit-identity-guard` | L4, L5 | open |
| 5 | #21 | `fix/wakelock-race` | B3 | open |
| 6 | #22 | `fix/ws-abuse-limits` | S1 | open |
| 7 | #23 | `fix/api-input-hardening` | S2, S3, S5 | open |
| 8 | #24 | `fix/client-small` | B4, B6, B8, B9 | open |
| 9 | #25 | `chore/security-headers` | S4 | open |
| 11 | #26 | `docs/spec-v2-proposal` | G1 to G4, L2, B7, S6 (proposal only, no code) | open |

Not done: row 3 (spec note, waits on D4), row 4 (join on tap, waits on D3), row 10 (CI changes, waits on the owner's
OK). The owner's phone-test results are not in the backlog yet; the owner will send them after deployment.

## Verification, honestly

- Run by the session: `npm run typecheck`, `npm test`, the Playwright suite on **Chromium (Pixel 7) only** against local
  `wrangler dev`, muted, and `scripts/smoke.sh` against the local server. Pull-request CI (typecheck and unit tests)
  was green for #18 to #25 when checked.
- **Never run:** WebKit / iPhone E2E (not installed in the session), any real device, staging, production. The
  WebKit proof for #19, #20, #24 and especially #25 (the CSP) is the staging E2E after merge.
- B1 and B5 were reproduced with a simulated dead socket (`page.routeWebSocket`), not on a phone.
- The review's other claims were reproduced where stated in each PR; B2 was not touched (row 4).

## Findings that came out of the work

1. **`main` (`7e7deaf`) has never been deployed.** Its Deploy run failed on 2026-10-23: the staging E2E step timed out
   in the iPhone two-player test (`friend.spec.ts`, 4 minutes twice, waiting in `fireOnce` after a Fire click), so the
   production job was skipped. Production still runs the code from PR #15. Merging any pull request triggers the same
   gate again. The log shows where it hangs but not why: either a lost shot (B1, which #19 fixes) or WebKit stalling
   `waitForFunction` on a background page, which is what the unmerged Copilot patch assumed. The two cannot be told
   apart from the log. Watch the first staging E2E after #19 merges.
2. **The Copilot pull request (#17) never ran CI** (`action_required`), so its patch is untested.
3. **The E2E suite is close to the create limit.** Game creation is limited to 20 per IP per 10 minutes and CI runs
   from one IP. Adding the tests in #19, #20, #22 and #25 takes the suite from 8 to about 17 games per run, before
   retries. A retry storm could trip the limit and fail the gate for a reason unrelated to the code. Row 10 should
   deal with this (raise the staging limit, or give tests a bypass).
4. Playwright 1.64 wanted a newer Chromium build than the one pre-installed in the session; a local, uncommitted config
   pointed at the pre-installed binary.

## Interventions

- `developers.cloudflare.com` was not on the session's allowed hosts, which blocked the docs check that `CLAUDE.md`
  requires for row 6. The session created a personal Claude Code environment `neon-tide` allowing only that host
  (the owner approved). No GitHub or Cloudflare account setting was changed.
- One commit was pushed in the same command as an E2E run that then failed (#21). The failures were the local create
  limiter (a fresh dev server passed); no pull request was open at the time.

## Decisions made

Appended to `docs/decisions.md` in each pull request: working on the handoff defaults; clear a lost shot on
reconnect (not on every `state`); sunk list in fleet order and a browser guard for hit identity; wake lock pending
state; WebSocket limits (16 sockets per game, 30 messages per 10 s per socket, 200 upgrades per 10 minutes per IP,
reusing `CreateLimiter`, no migration); create-request hardening and the IPv6 /64 key; client small fixes; security
headers via `public/_headers`; the v2 proposal.

## Docs facts used (read 2026-11-13)

Durable Object attachments max 16,384 bytes, received WebSocket messages max 32 MiB, soft 1,000 requests per second per
object, rate-limiting binding approximate and per location, `_headers` applies to static assets only. No per-object
WebSocket cap is stated on the pages read, so the 16 in #22 is this project's own number.
