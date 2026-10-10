# Neon Tide: Phase 1 Spec (frozen)

Status: frozen for Phase 1 MVP. Changes go through `docs/decisions.md`.

## 1. Product

**Neon Tide** (tagline: **Sink Cube**) is a browser-only, phone-first naval grid game. Two players hide fleets on a 10x10 grid and alternate shots until one fleet is sunk. Play vs. a friend via a shared link, or vs. the computer. One link is one game. Dark neon arcade look.

## 2. Hard constraints

1. **No secrets in the repo.** Never print, request, or write tokens or account credentials to any file (including `.dev.vars`, which is gitignored).
2. **Branch discipline.** All work on feature branches, one small PR per change, never commit to `main`. Merge only when checks are green.
3. **No irreversible actions:** no force-push, no deleting remote branches, no changing GitHub or Cloudflare account settings. Production deploys follow the rule in section 9.
4. **Naming and IP.**
   - User-facing text, manifest, OG tags, package name, and code identifiers must not use the Hasbro trademark or any Hasbro art or ship pieces.
   - Visual style is inspired by 1980s arcade neon. Do not use Q*bert characters, sprites, logo, or name.
   - Use "naval grid game" in docs.
5. **Verify, don't recall.** Cloudflare Workers/Wrangler config, Durable Object migrations, and Playwright config change often. Check current official docs before writing config.
6. **Log every non-trivial decision** in `docs/decisions.md`.
7. **Stop and report** if a gate fails 3 times (proposed threshold, not yet confirmed by the owner) or a step would be irreversible.

## 3. Rules

- 10x10 grid, columns A-J, rows 1-10.
- Fleet: Carrier 5, 4-length ship (called **Dreadnought** in UI), Cruiser 3, Submarine 3, Destroyer 2.
- Ships are horizontal or vertical, cannot overlap, **may touch**. No repositioning after Ready.
- One shot per turn. A hit does **not** grant an extra turn. Strict alternation.
- Result shown to the shooter: miss, hit (with ship name), or sunk (with ship name).
- Win: sink all five enemy ships.
- First turn: random coin flip, decided server-side.
- **One link is one game.** No series, no rematch. Game over shows the winner and a "New game" button back to home. A finished link stays finished.

## 4. Modes

- **Vs. friend:** Create game, share link (Web Share API, copy-link fallback), friend taps to join.
- **Vs. computer:** starts instantly, no link. **One difficulty: hard**, probability-based. For each unshot cell, count legal placements of the remaining unsunk ships covering it, fire at the maximum, break ties randomly, recompute every shot. The computer never sees the player's board.

## 5. Client behavior

- **Placement:** tap a ship, tap a cell, Rotate button, Randomize button, Ready button. No drag-and-drop.
- **Feedback:** sound with a visible mute toggle; vibration on hit/miss/sunk (Android only, since iOS Safari lacks the Vibration API); color-flip animation on each shot, bounce on sunk.
- **Identity:** random token in `localStorage`, no accounts. Clearing browser data mid-game loses the seat (accepted limitation).
- **Platform:** iPhone Safari primary, Android Chrome secondary. Installable PWA (manifest + icons). Use `dvh`, safe-area insets, `touch-action: manipulation`. Screen Wake Lock during play. Open Graph tags so links preview in iMessage/WhatsApp.
- **Design tokens:** `public/css/tokens.css` is the source of truth. Dark near-black blue-tinted background, flat, no gradients. Cells are CSS-bevel "cubes"; a shot flips the cube to a bright color. Each state also needs a shape cue, not color alone.

## 6. Lifecycle

- Durable Object lives from placement to game over.
- Unfinished games expire after 24h of inactivity.
- A disconnected player has a 2-minute grace period before the opponent is notified. The game stays resumable from the same link.

## 7. Architecture

- **Cloudflare Workers** with Static Assets serving `public/`, plus a Durable Object class `GameRoom` (one per game). SQLite-backed (`new_sqlite_classes`). Per-environment Wrangler blocks do not inherit DO bindings or migrations, so repeat them.
- **Server-authoritative.** Ship positions exist only on the server. Clients receive only results and their own board. Never send the opponent's board.
- **WebSocket** per player into the DO (hibernation API; verify current docs). The DO holds both boards, turn state, and the computer opponent. Vs. computer uses the same engine in the same DO: one code path.
- **Engine** in `src/engine/` is pure TypeScript with no Cloudflare imports, unit-testable in plain Node. Rules live in a `RulesConfig` object passed to the engine so Phase 2 rules are additive.
- **Game IDs:** unguessable, at least 64 bits from `crypto.getRandomValues`, base32 or similar.
- **Rate limiting:** basic per-IP limit on game creation.
- **Client:** vanilla HTML/CSS/JS, ES modules, no framework, no build step beyond what Wrangler needs.
- **Language:** TypeScript for worker and engine.

**Message protocol** (design in build phase):
- Client to server: `create`, `join`, `place`, `ready`, `fire`, `ping`, `resume`.
- Server to client: `state` (personalized snapshot: your board, your shot history, opponent shots at you, turn, phase, fleet-alive status), `result`, `opponent_status` (connected/disconnected), `error`.

## 8. Out of scope for Phase 1

Accounts, match history, stats, spectators, chat, Supabase, analytics, series/rematch.

## 9. Environments and deploy

- Staging: `https://neon-tide-staging.kristian-dermody-personal-account.workers.dev`, deployed on every merge to `main`.
- Production: `https://neon-tide.kristiandermody.com`. Owner decision: production deploys **automatically after staging succeeds** on `main` (replaces the current manual dispatch; update `.github/workflows/deploy.yml`).
- Add a `pull_request` workflow running typecheck and tests.

## 10. Acceptance criteria (pass/fail)

1. Engine unit tests cover placement validation, firing, hit/miss/sunk, win detection, and the hard AI, and pass in plain Node.
2. Vs. computer: a full game is playable start to finish on a phone-width viewport.
3. Vs. friend: two clients complete a full game over WebSocket via a shared link.
4. The opponent's ship positions never appear in any message to a client (test asserts this).
5. A player who disconnects and reconnects within the grace period resumes the same game from the same link.
6. Finished and expired links show the correct end state and cannot be replayed.
7. Playwright E2E passes against staging.
8. PWA installs on iPhone Safari; link previews render via OG tags.
9. Owner and cousin finish a full game on real iPhones (Android tester if available).

## 11. Build order

Engine + tests -> computer-mode UI -> two-player over WebSocket -> reconnect hardening (lock screen / return cases) -> Playwright E2E -> staging beta URL -> acceptance.

## 12. Phase 2 backlog (do NOT build; keep the engine open for it)

- **Barrage:** limited-use multi-shot; each surviving ship fires one missile in the same turn. Open: shared pool of 2 per player, or per ship.
- **Hidden sinking:** the defender does not announce a sunk ship. Open: always-on or one-time ability.
- **Easy and medium AI difficulty** plus a difficulty selector.

## 13. Report-back format

When finished or stopped, reply with:
1. Bottom line: done, or stopped at step X because Y.
2. PR URL and branch name.
3. Verification commands run and pass/fail.
4. Interventions logged (count and one line each).
5. Decisions made that the spec did not cover.
6. What the owner must do next.
