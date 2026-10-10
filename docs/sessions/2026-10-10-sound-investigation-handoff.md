# Handoff: stray game sounds (where we started, where we ended, next steps)

Short companion to `2026-10-10-sound-investigation-report.md` (the full chronology). No secrets.

## 1. Where we started

- The build session (a separate Claude Code session) was building Neon Tide Phase 1. `main` was at `896fab2` (PR #10, PWA), and `wrangler dev --env staging --port 8787` was running.
- Game sound effects kept playing through the owner's speakers at seemingly random times, with no game window in use.
- The cause was unknown. Suspects were Claude Code hooks, a terminal bell, or an open game tab.

## 2. Where we ended

- **Root cause (verified):** the build session's Playwright tests. They run the game in headless Chromium and WebKit from a scratch folder outside the repo. Headless browsers still play audio. The tests' clicks unlock the game's Web Audio, so every simulated shot plays a tone (`public/js/feedback.js`, triggered from `public/js/app.js:236-245` and `:537`).
- **Ruled out (verified):** Claude Code hooks, command-line audio players, and audio files.
- **Code changes:** none. This PR adds only these two docs.
- **Fix:** written up and given to the owner to pass to the build session. It is not applied yet.

## 3. Next steps

1. In every Playwright setup for this game (the build session's scratch scripts now, `e2e/` later):
   - Chromium: `launch({ args: ['--mute-audio'] })`.
   - Every context: `await context.addInitScript(() => localStorage.setItem('nt:muted', '1'))`.
2. Optional: record the "tests run muted" choice in `docs/decisions.md` when the `e2e/` config lands.
3. Until the fix is in, turn down the volume during test runs. The sound stops when the test browsers exit.
