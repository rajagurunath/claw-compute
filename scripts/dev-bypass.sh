#!/usr/bin/env bash
# Toggle the no-login dev bypass for the web frontend.
#   on:  mints a 24h JWT for $EMAIL (default rajagurunath5@gmail.com),
#        writes CLAW_DEV_BYPASS_AUTH=1 + CLAW_DEV_JWT=<jwt> to web/.env.local
#   off: removes those lines
# Restart the web dev server after running this for changes to apply.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/web/.env.local"
ACTION="${1:-on}"
EMAIL="${EMAIL:-rajagurunath5@gmail.com}"
API="${CLAW_API_URL:-http://localhost:8000}"
LOG="$ROOT/.logs/api.log"

if [ "$ACTION" = "off" ]; then
    if [ -f "$ENV_FILE" ]; then
        grep -v "^CLAW_DEV_" "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
    fi
    echo "✔ dev bypass disabled — restart 'make web' for changes"
    exit 0
fi

if ! curl -fsS "$API/v1/health" >/dev/null 2>&1; then
    echo "ERROR: API not reachable at $API. Run 'make api' or 'make up' first."
    exit 1
fi

mkdir -p "$(dirname "$LOG")"
touch "$LOG"

curl -fsS -X POST "$API/v1/auth/magic-link" -H 'Content-Type: application/json' \
     -d "{\"email\":\"$EMAIL\"}" >/dev/null
sleep 0.6
TOK=$(grep -E "MAGIC LINK for $EMAIL" "$LOG" | tail -1 | sed 's/.*token=//')

if [ -z "$TOK" ] && [ -n "${CLAW_DEV_BYPASS_TOKEN:-}" ]; then
    TOK="$CLAW_DEV_BYPASS_TOKEN"
    echo "→ using CLAW_DEV_BYPASS_TOKEN from env" >&2
fi

if [ -z "$TOK" ]; then
    cat <<MSG >&2
ERROR: didn't find a magic-link token in $LOG.

This usually means 'make api' was started BEFORE the Makefile was updated
to tee its output to $LOG. Two ways forward:

  1. Restart the API so it tees:
       Ctrl-C 'make api' in Terminal 1, then run 'make api' again.
       Then re-run 'make dev-bypass'.

  2. Or paste a magic-link token manually:
       In Terminal 1 you'll see lines like
         MAGIC LINK for $EMAIL: token=<value>
       Then run:
         CLAW_DEV_BYPASS_TOKEN=<value> make dev-bypass

MSG
    exit 1
fi
JWT=$(curl -fsS -X POST "$API/v1/auth/verify" -H 'Content-Type: application/json' \
     -d "{\"token\":\"$TOK\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

[ -f "$ENV_FILE" ] || touch "$ENV_FILE"
grep -v "^CLAW_DEV_" "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
{
    echo "CLAW_DEV_BYPASS_AUTH=1"
    echo "CLAW_DEV_JWT=$JWT"
} >> "$ENV_FILE"

cat <<EOF
✔ dev bypass enabled for $EMAIL (24h)
  $ENV_FILE updated
  Restart the web server for changes:
      make down && make up
   or, if running in foreground: Ctrl-C then 'make web' again.
EOF
