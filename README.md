# Neon Tide

Browser-based naval grid game for phones. Tagline: Sink Cube.

Status: Phase 1 in progress. See `docs/spec.md` for the frozen spec and `docs/decisions.md` for the decision log.

## Stack

- Cloudflare Workers with Static Assets (`public/`) and a SQLite-backed Durable Object (`GameRoom`) per game.
- TypeScript for the Worker and the game engine (`src/`); vanilla HTML, CSS and ES modules for the client.
- Design system: `public/css/tokens.css` (generated from the design system's `tokens.json`; do not hand-edit) and `public/css/neon-tide.css` (`nt-` components).

## Develop

Requires Node 22.18 or later (unit tests run TypeScript directly with Node's built-in test runner).

```sh
npm ci
npm run dev        # local Worker via wrangler dev
npm run typecheck
npm test           # unit tests in test/
npm run e2e        # Playwright E2E (iPhone WebKit + Pixel Chromium) against E2E_BASE_URL, default http://localhost:8787
npm run smoke -- https://neon-tide-staging.kristian-dermody-personal-account.workers.dev
```

First E2E run on a machine: `npx playwright install chromium webkit`.

## CI and deploy

- Pull requests to `main` run typecheck and unit tests (`.github/workflows/ci.yml`).
- Every merge to `main` deploys staging, runs the curl smoke test and the Playwright E2E suite against it, then deploys production and smoke-tests it (`.github/workflows/deploy.yml`).
  - Staging: https://neon-tide-staging.kristian-dermody-personal-account.workers.dev
  - Production: https://neon-tide.kristiandermody.com
