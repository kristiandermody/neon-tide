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
2026-10-10 | PR workflow `ci.yml`: npm ci, typecheck, unit tests on pull requests to `main` | Run checks inside deploy.yml | Separate trigger and no secrets in PR runs | yes
2026-10-10 | Unit tests use Node's built-in `node --test` on `.ts` files (native type stripping, Node >= 22.18) | Vitest, Jest | No extra dependencies; engine runs in plain Node as the spec requires | yes
2026-10-10 | Production is a `needs: staging` job in the same deploy workflow; `workflow_dispatch` reruns the whole chain, no production-only dispatch | Separate workflow via `workflow_run` | Simplest way to guarantee production only follows a green staging deploy | yes
2026-10-10 | Bump to `actions/checkout@v7` and `actions/setup-node@v7` (node24 runtime); CI uses Node 24 LTS | Stay on v4 | Node 20 action runtime deprecated; v7 are the current releases | yes
2026-10-10 | Deploy jobs disable setup-node dependency caching (`package-manager-cache: false`); PR job keeps npm cache | Cache everywhere | setup-node docs recommend no cache in secret-holding jobs to reduce cache-poisoning risk | yes
2026-10-10 | Deploy jobs run typecheck and tests before staging deploy | Rely on PR checks only | Guards direct pushes and dispatch reruns | yes
2026-10-10 | Workflow `permissions: contents: read` | Default token permissions | Least privilege | yes
2026-10-10 | Engine state is plain JSON (`GameState`), mutated by pure functions that take `RulesConfig`; cells are row-major indices 0-99 | Class with methods | Stores directly in the Durable Object and round-trips through JSON | yes
2026-10-10 | Fleet placement is submitted whole (`place`), replaceable until `ready` | Per-ship place messages | Client keeps the in-progress layout; server validates one complete fleet | yes
2026-10-10 | A sunk result reveals that ship's cells to the shooter | Reveal only the final cell | The design system flips the whole ship to the sunk state; all its cells were already hit, so no hidden information leaks | yes
2026-10-10 | Hard AI uses the shooter's knowledge of ship names on hits: a placement must cover all known hits of its own ship and none of another's; while any afloat ship is damaged, only damaged ships are counted | Pure density over all ships | Same information a human sees; keeps the spec's legal-placement counting but finishes wounded ships. Measured average 44 shots to win over 300 seeded games | yes
2026-10-10 | `shipsMayTouch` lives in `RulesConfig` (true for Phase 1) | Hard-code | Keeps alternative rule sets additive | yes
2026-10-10 | Separate `tsconfig.test.json` typechecks engine and tests with Node types only | One config | Proves the engine has no Cloudflare dependency | yes
