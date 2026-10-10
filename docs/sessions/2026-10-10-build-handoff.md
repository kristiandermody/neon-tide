# Build handoff for Claude Code: sync the repo, then build Neon Tide Phase 1

> **Status: completed 2026-10-10.** Outcome in `2026-10-10-build-session-report.md`; resume from `2026-10-10-build-session-handoff.md`.

You are the build agent. The owner (Kristian) wants minimal interaction. Work autonomously within the rules below and report at the end.

**Hard gate:** do not start section 3 (building the game) until every item in the section 2 sync checklist is true.

## 0. Read first
1. `CLAUDE.md`, `docs/spec.md` (frozen Phase 1 spec, single source of truth), `docs/decisions.md`.
2. `docs/sessions/2026-10-10-handoff.md` (infrastructure state) for context only.

## 1. Preflight (stop and report if any fails)
- `gh auth status` works for `kristiandermody/neon-tide`. Never print or write tokens.
- `git status -sb`, `git branch -a`, `git fetch origin`. Note which branches exist, which are unpushed, and which are unmerged.
- `.claude/` must not be committed. Add `.claude/` to the repo `.gitignore` in the docs PR below.

## 2. Sync everything first (one small PR each, never commit to `main`)

### 2.0 Back up local state before touching anything
- Push `feat/design-system-css` as-is (it holds unpushed commit 38ec5a2) so nothing exists only on this machine. Push any other unpushed local branch too.
- Do not rebase, reset, or delete anything until these pushes succeed.

### 2.1 Docs PR
Branch `docs/spec` from `main`. Commit these files only: `CLAUDE.md`, `docs/spec.md`, `docs/decisions.md`, `docs/sessions/2026-10-10-build-handoff.md` (this file), plus the `.gitignore` change. Push, open PR, merge when checks are green.

### 2.2 Design system PR
The Neon Tide design system has already been built and added to the site. Treat it as finished work to ship, not something to redo:
- `public/css/tokens.css`: design tokens as CSS custom properties, **generated from the design system's `tokens.json`**. `tokens.json` is the source of truth and is not in this repo. **Do not hand-edit values in `tokens.css`.** If a token needs to change, log it in `docs/decisions.md` and tell the owner so it can be regenerated from the design system.
- `public/css/neon-tide.css`: component CSS (`nt-` BEM blocks, no dependencies, 756 lines).
- `public/index.html`: the placeholder page already links both files (`tokens.css` first, then `neon-tide.css`) and shows the wordmark and tagline. This is the "added to the index" work.
- Known gap: the Press Start 2P font is not bundled. The `@font-face` rule in `tokens.css` is commented out until `public/fonts/press-start-2p.woff2` exists (SIL OFL 1.1). Until then arcade text falls back to system monospace. Add the font file only if you can obtain it from a legitimate source reachable from CI or the owner supplies it; otherwise leave it and report it.

Steps: rebase `feat/design-system-css` onto latest `main`, push, open PR, merge when green. Before merging, check the design system against spec section 5 (dark near-black blue-tinted background, flat, no gradients, CSS-bevel cube cells, a shape cue per state beyond color). Report any mismatch instead of editing `tokens.css`; fix `neon-tide.css` or `index.html` only for real bugs. No Hasbro or Q*bert references anywhere. The game UI must use these tokens and `nt-` components, not new ad-hoc styles.

### 2.3 CI PR
Edit `.github/workflows/deploy.yml` and add a `pull_request` workflow:
- Pull request workflow: install, typecheck, unit tests.
- Production deploys automatically after the staging deploy succeeds on `main` (owner decision; replaces manual dispatch). Verify current GitHub Actions and Wrangler docs before editing.
- Bump `actions/checkout` and `actions/setup-node` (Node 20 deprecation).
- Update the README (it still says "repo structure only").
- Log each choice in `docs/decisions.md`.

### 2.4 Sync checklist (all must be true before section 3)
- [ ] Every local branch is pushed; nothing exists only locally.
- [ ] Docs PR merged; `CLAUDE.md`, spec, decisions and this handoff are on `main`.
- [ ] Design system PR merged; `tokens.css`, `neon-tide.css`, and the linked `index.html` are on `main`.
- [ ] CI PR merged; PR workflow passes; staging deploy from `main` succeeded.
- [ ] Local `main` equals `origin/main` (`git fetch`, then compare). Merged local branches pruned.
- [ ] Working tree clean (`.claude/` ignored).

If the auto-mode classifier blocks a merge, a production deploy, or a settings edit: stop, report the exact command, and let the owner run it. Resume once the checklist is true.

## 3. Build Phase 1 (spec section 11 order; one small PR per step, green checks before merge)
1. **Engine** in `src/engine/`: pure TypeScript, no Cloudflare imports, `RulesConfig` passed in. Placement validation, firing, hit/miss/sunk, win detection, hard probability AI (spec section 4). Unit tests first, run in plain Node.
2. **Computer-mode UI**: home screen, tap-to-place with Rotate/Randomize/Ready, firing, results, game over. Vanilla ES modules, built on the design system's tokens and `nt-` components. Sound with mute toggle, Android vibration, shot animations.
3. **Two-player over WebSocket**: `GameRoom` Durable Object (SQLite-backed, hibernation API), protocol per spec section 7, server-authoritative, unguessable game IDs, per-IP create rate limit, shareable link with Web Share API and copy fallback.
4. **Reconnect hardening**: 2-minute grace, 24h expiry, resume from same link, wake lock, lock-screen and return cases.
5. **PWA and sharing**: manifest, icons, safe-area insets, `dvh`, Open Graph tags.
6. **Playwright E2E** under `e2e/`, plus curl smoke tests of the staging URL (`--http1.1` for WebSocket).
7. **Staging beta**: merge to `main`, confirm staging deploys, run E2E against it.

## 4. Rules that always apply
- Do not build anything in the Phase 2 backlog (Barrage, hidden sinking, easy/medium AI).
- Verify Cloudflare, Wrangler, Durable Object, and Playwright config against current official docs before writing it.
- Log every decision the spec does not cover in `docs/decisions.md`.
- No secrets, no force-push, no deleting remote branches, no account setting changes.
- Stop and report after 3 failed attempts at the same gate, or before any irreversible step.
- Free-plan limits apply to Durable Objects; keep WebSocket hibernation.

## 5. Report back (spec section 13)
1. Bottom line: done, or stopped at step X because Y.
2. PR URLs and branch names.
3. Verification commands run and pass/fail.
4. Interventions (count and one line each).
5. Decisions made that the spec did not cover.
6. What the owner must do next.

## 6. Owner to-do (not yours)
- Regenerate `tokens.css` from the design system if any token change is requested.
- Supply `press-start-2p.woff2` if the agent could not get it.
- Calendar reminder: roll the Cloudflare CI token before 2027-01-08.
- Final acceptance: owner and cousin finish a full game on real iPhones.
