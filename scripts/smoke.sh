#!/usr/bin/env bash
# Smoke-tests a deployed Neon Tide: static assets, SPA fallback, API guards, WebSocket upgrade.
# Usage: scripts/smoke.sh https://neon-tide-staging.kristian-dermody-personal-account.workers.dev
set -euo pipefail
BASE="${1:?base URL}"
fail=0

check() { # name expected actual
  if [[ "$3" == "$2" ]]; then echo "ok   $1 ($3)"; else echo "FAIL $1: expected $2, got $3"; fail=1; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

check "index"            200 "$(code "$BASE/")"
check "index title"      1   "$(curl -s "$BASE/" | grep -c '<title>Neon Tide</title>')"
check "tokens.css"       200 "$(code "$BASE/css/tokens.css")"
check "app.js"           200 "$(code "$BASE/js/app.js")"
check "manifest type"    "application/manifest+json" "$(curl -s -o /dev/null -w '%{content_type}' "$BASE/manifest.webmanifest")"
check "game link (SPA)"  200 "$(code "$BASE/g/0000000000000000")"
check "api GET"          405 "$(code "$BASE/api/games")"
check "api bad body"     400 "$(code -X POST -H 'content-type: application/json' -d '{"mode":"computer","token":"x"}' "$BASE/api/games")"
check "ws bad id"        404 "$(code "$BASE/ws/not-an-id")"
ws_code=$(curl -s --http1.1 -o /dev/null -m 5 -w '%{http_code}' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' "$BASE/ws/0000000000000000" || true)
check "ws upgrade"       101 "$ws_code"

exit $fail
