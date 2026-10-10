# Session report: 2026-10-10 (stray game sounds on the owner's speakers)

Chronological record of a short diagnostic session. A separate Claude Code session was building the game at the same time; this session only investigated and wrote these docs. No code was changed. No secrets are recorded here. See `2026-10-10-sound-investigation-handoff.md` for the start state, end state and next steps.

Conventions: **Verified** means observed directly (command output, process list). **Inferred** means reasoned from code or timing and not directly confirmed.

## 0. Problem

While the build session was working, game sound effects kept playing through the owner's speakers "randomly", with no game window visibly in use.

## 1. Ruled out (verified)

- **Claude Code hooks:** `~/.claude/settings.json` and `settings.local.json` contain no sound-playing hooks (`afplay`, `say`, audio files, bell).
- **Command-line audio players:** no `afplay`, `say`, `sox`, `ffplay`, `mpv`, `vlc` or `osascript` processes were running.
- **Audio files in the repo:** there are none. The game synthesizes all sound.

## 2. How the game makes sound (verified, from code)

- `public/js/feedback.js` builds tones with the Web Audio API (`AudioContext` + oscillators). Sounds: `fire`, `miss`, `hit`, `sunk`, `win`, `lose`, `tap`.
- `unlockAudio()` creates or resumes the `AudioContext`. Browsers only allow this after a user gesture, so it is called from one.
- `play(name)` does nothing if muted (`localStorage` key `nt:muted` = `"1"`) or if the context is not running.
- Once unlocked, sound also plays **without** any local input:
  - `public/js/app.js:236-245`: `animate()` plays `miss` / `hit` / `sunk` for every shot result, including the opponent's shots arriving over the WebSocket.
  - `public/js/app.js:537`: `showGameOver()` plays `win` / `lose`.

## 3. First hypothesis (inferred, later refined)

Only `wrangler dev --env staging --port 8787` was running, started by the build session. The first guess was an open `localhost:8787` tab in the owner's Chrome playing sounds when the build session made moves as the second player. This could not be checked: the Claude in Chrome extension was not connected.

## 4. Root cause, caught while the sound was playing (verified)

When the owner reported the sound was playing at that moment:

- `pmset -g assertions` showed `coreaudiod` holding an **audio-out** assertion that had started **26 seconds** earlier.
- The process list showed **Playwright**, launched **28 seconds** earlier by the build session's Claude process, running a **headless Chromium** (`chrome-headless-shell`) and a **headless WebKit**. Its working directory was a scratch `pw/` folder in the build session's scratchpad, not the repo. The repo's `e2e/` folder is still empty.

So the sound came from the build session's own browser tests. Playwright drives the game like a player. Its clicks count as the user gesture that unlocks audio, and every simulated shot then plays a real tone.

## 5. Why a headless browser plays sound

"Headless" only means the browser draws no window. It still runs the page's JavaScript, including Web Audio, and sends the audio to macOS like any other app. macOS plays it on the default output whether or not a window exists. Muting must be asked for explicitly.

## 6. Fix (recommended, not applied in this session)

The test scripts belong to the build session and were in use, so this session did not edit them. The owner was given this to pass to the build session:

- Chromium: launch with `args: ['--mute-audio']`.
- Every browser context, all engines: `await context.addInitScript(() => localStorage.setItem('nt:muted', '1'))`. This uses the game's own mute setting, so it also covers WebKit, which has no mute flag. The game's code paths stay exercised, minus the sound.
- Carry both into the future `e2e/` Playwright config.

## 7. Lessons for agents

- Headless browsers are not silent. Mute them in every Playwright or Puppeteer setup that loads this game.
- To find what is making sound on macOS, run `pmset -g assertions | grep -i audio` and match the assertion's age against process start times (`ps -axo pid,ppid,etime,command`).
- A "random" sound with no visible window usually means an automated browser started by another process.
