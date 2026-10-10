# Neon Tide: agent instructions

Read before doing anything:
1. `docs/spec.md` is the frozen Phase 1 spec and the single source of truth.
2. `docs/decisions.md` is the decision log. Append every decision the spec does not cover.
3. The latest handoff in `docs/sessions/` (currently `2026-10-10-build-session-handoff.md`) and `docs/backlog.md` (v2 candidates, known issues, bugs).

Rules:
- Build Phase 1 only. Never build anything in the spec's Phase 2 backlog.
- Feature branches, one small PR per change, never commit to `main`. Merge only when checks are green.
- No secrets in the repo. Do not print or write tokens. `.claude/` is local-only and must not be committed.
- No force-push, no deleting remote branches, no account setting changes.
- Verify Cloudflare, Wrangler, Durable Object, and Playwright config against current official docs before writing it.
- Stop and report after 3 failed gate attempts or before any irreversible step.
- Finish with the report-back format in the spec (section 13).
