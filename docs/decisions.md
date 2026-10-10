# Decision Log

Format: `date | decision | alternatives | why | reversible?`
Append new entries; do not rewrite old ones. The build agent logs every decision the spec did not cover.

2026-10-10 | Static assets + Durable Object on Workers | Pages, Supabase | Simplest fit for turn-based realtime; Supabase only if accounts or history are added | yes
2026-10-10 | SQLite-backed DO class | KV-style DO | Current recommended DO storage | yes
2026-10-10 | TypeScript for worker and engine, vanilla JS for client | Framework client | No build step, small surface | yes
2026-10-10 | Staging deploys on every merge to `main` | Manual | Fast feedback | yes
2026-10-10 | Production deploys automatically after staging succeeds | Manual dispatch | Owner decision; replaces earlier manual-only plan | yes
2026-10-10 | Staging on workers.dev; production on neon-tide.kristiandermody.com | workers.dev only | Owner chose custom domain | yes
2026-10-10 | Vs-computer kept in Phase 1, one hard probability-based level | Cut computer mode; easy/medium | Needed for testing and early playable milestone | yes
2026-10-10 | Barrage, hidden sinking, easy/medium AI moved to Phase 2 | Include in MVP | Scope control | yes
2026-10-10 | 4-length ship named "Dreadnought" in UI | Original class name | Trademark avoidance | yes
2026-10-10 | Working name Neon Tide, tagline Sink Cube | Other names | Owner choice | yes
2026-10-10 | One link is one game; no rematch or series | Rematch flow | Scope control | yes
2026-10-10 | Gate-failure stop threshold N=3 | Other values | Proposed; not yet confirmed by owner | yes
2026-10-10 | Colors in tokens.css are proposals | Final palette | Pending UI phase | yes
2026-10-10 | Build handoff file replaced with the owner's newer pasted version (adds backup step and sync checklist; tokens.css not hand-edited) | Keep older on-disk draft | Pasted version is the owner's latest instruction | yes
2026-10-10 | Add `.claude/` to repo `.gitignore` | Rely on global ignore only | Global ignore covers only settings.local.json on this machine | yes
2026-10-10 | Docs and design-system PRs merged before any PR checks exist | Land CI PR first | Handoff fixes the order; no checks to wait on until the CI PR lands | yes
