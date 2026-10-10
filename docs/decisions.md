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
2026-10-10 | Computer mode built on the `GameRoom` DO and the WebSocket protocol in step 2 (computer holds seat 1, moves inside the same handler) | Browser-only computer game first | Spec section 7: one code path, server-authoritative | yes
2026-10-10 | Game creation is `POST /api/games` (the spec's `create`); WebSocket messages are `join`, `resume`, `place`, `ready`, `fire`, `ping` | `create` as a WebSocket message | The Worker sees the client IP for rate limiting before a DO exists | yes
2026-10-10 | Per-IP create limit: 20 games per 10 minutes, enforced by a SQLite-backed `CreateLimiter` DO keyed by IP (migration v2) | Workers rate-limiting binding | Binding's Free-plan availability not confirmed in docs and it is per-location; DO is exact and known to work on Free | yes
2026-10-10 | Game ids: 80 random bits as 16 Crockford base32 chars; URL `/g/<id>` for both modes (computer games just show no share UI) | Hide id for computer games | Lets a computer game resume after reload or lock screen | yes
2026-10-10 | Keep-alive `ping` answered by `setWebSocketAutoResponse` (no DO wake) | Handle ping in code | Keeps hibernation effective on the Free plan | yes
2026-10-10 | Assets: `not_found_handling: single-page-application`, `run_worker_first: ["/api/*", "/ws/*"]` | Worker serves HTML | Static by default; Worker only for API and sockets | yes
2026-10-10 | Client keeps a small copy of fleet geometry (`public/js/fleet.js`) for placement preview and Randomize only; the server validates with the engine | Serve engine to client | No client build step; server stays authoritative | yes
2026-10-10 | Placement starts empty with the Carrier selected; tapping a placed ship selects it to move; Rotate re-places in place when it fits | Start randomized | Matches spec's tap-ship, tap-cell flow; Randomize is one tap away | yes
2026-10-10 | Results animate in order (yours, then the opponent's after `--dur-hold`); the client applies each result locally, then takes the next `state` as truth | Render state only | Lets the player read each shot before the turn flips | yes
2026-10-10 | Battle layout: target board, then one panel with your mini board and both compact fleet trackers; `--board-chrome: 340px` on this screen | Separate own-board section | Fits a 390x664 iPhone viewport without scrolling; tested iPhone 13, Pixel 7, iPad Mini | yes
2026-10-10 | Minimum supported width is 360px, per the design system; 320px phones scroll horizontally | Shrink cells below 32px | Design tokens set 32px minimum cells | yes
2026-10-10 | Sounds are synthesized with Web Audio (no audio files); vibration on miss/hit/sunk/win/lose is independent of the mute toggle | Audio files; mute also silences vibration | Zero assets; mute is labelled as sound | yes
2026-10-10 | Friend games open on an invite screen (link field plus Share via Web Share API, Copy fallback via Clipboard API then select-and-copy); the creator may place while waiting, and the invite stays on the waiting screen until the friend joins | Require join before placement | Fewer idle seconds; spec only requires the share flow | yes
2026-10-10 | Any third device opening a full game link is refused (`game_full`, or `game_over` once finished); there is no spectating | Spectator view | Spectators are out of scope (spec section 8) | yes
2026-10-10 | Home puts "Play a friend" as the primary action and "Play the computer" second | Computer first | Two-player is the product's main mode | yes
2026-10-10 | One DO alarm drives both the 2-minute disconnect grace and 24h expiry; deadlines come from the stored record (`nextAlarm`) | Separate timers; setTimeout | Alarms survive hibernation and eviction; one source of truth | yes
2026-10-10 | `opponentConnected` in `state` turns false only after the grace period, so short drops are invisible to the opponent | Report socket state live | Spec: opponent is notified only after 2 minutes | yes
2026-10-10 | Joins, resumes and moves all count as activity for the 24h expiry | Moves only | A player returning to a game keeps it alive | yes
2026-10-10 | Finished and expired game records are kept (no deletion) so their links keep showing the end state | Delete after N days | Records are under 2 KB; spec requires finished links to stay finished | yes
2026-10-10 | Removed the scaffold's `ws.close(code)` echo in `webSocketClose`; it threw on reserved codes 1005/1006 and skipped disconnect handling. Compat date 2026-10-01 auto-replies to Close | Filter codes before echoing | Per current DO WebSocket docs the echo is no longer required | yes
2026-10-10 | Client probes the socket on return (visibilitychange, pageshow, online): a ping must get any reply within 3 s or the socket is replaced and the seat resumed | Trust readyState | iOS can leave a dead socket reporting OPEN after the lock screen | yes
2026-10-10 | Screen Wake Lock held from game load until the game ends, re-requested on every return to the page | Only during your turn | Phones dim while waiting for the opponent; the browser drops the lock when hidden | yes
2026-10-10 | Client closes its socket once the game is over or expired | Keep it open | Nothing more can happen; saves DO wakeups on the Free plan | yes
2026-10-10 | No service worker: manifest plus 192/512 icons only | Offline cache SW | Current Chrome install criteria list no SW; iOS Add to Home Screen needs none; a SW risks stale clients during the beta. Chrome reports zero installability errors | yes
2026-10-10 | App icon is the design system's sunk cell (magenta cube, block with X cut out), drawn as SVG and rendered to 192/512/maskable/180 PNGs | Wordmark icon | Reads at small sizes; colours from tokens.css | yes
2026-10-10 | OG image (1200x630, wordmark + tagline) with absolute production URL in static index.html; staging previews also fetch it from production | Per-env HTML rewriting in the Worker | Scrapers need absolute URLs; keeps assets static | yes
2026-10-10 | iOS standalone uses `black-translucent` status bar with `env(safe-area-inset-*)` padding (top always; sides under 768px only, so the wide layout keeps its gutter) | Default status bar | Full-bleed dark screen in the installed app | yes
2026-10-10 | E2E runs in the deploy workflow after the staging deploy and gates production (staging job = deploy + smoke + E2E) | Separate post-deploy workflow; run E2E in PRs against wrangler dev | Spec acceptance is "E2E passes against staging"; a broken build never reaches production | yes
2026-10-10 | Playwright projects: iPhone 13 (WebKit) and Pixel 7 (Chromium), `reducedMotion: reduce` | Desktop browsers | Matches the spec's primary and secondary platforms | yes
2026-10-10 | Under reduced motion the result hold shortens to `--dur-turn` | Always hold `--dur-hold` | Nothing is animating to wait out; also makes full-game E2E fast | yes
2026-10-10 | `scripts/smoke.sh` curls index, assets, manifest type, SPA fallback, API guards and a `--http1.1` WebSocket upgrade (101); runs on staging and production after each deploy | Playwright only | Cheap, fast, no browser | yes
2026-10-10 | Separate `tsconfig.e2e.json` (Node + DOM libs) for Playwright specs | One test config | Page callbacks need DOM types; engine config must stay Node-only | yes
