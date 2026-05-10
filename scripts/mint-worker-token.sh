#!/usr/bin/env bash
# Mint a CLAW_WORKER_TOKEN for a given email, end-to-end.
# Idempotent: if the email already has a supplier account, reuses it.
# Prints export commands you can paste into your shell.
set -euo pipefail

EMAIL="${1:?usage: mint-worker-token.sh <email>}"
API="${CLAW_API_URL:-http://localhost:8000}"
LOG="${CLAW_API_LOG:-${ROOT:-$(dirname "$0")/..}/.logs/api.log}"

if ! curl -fsS "$API/v1/health" >/dev/null 2>&1; then
    echo "ERROR: API not reachable at $API. Run 'make api' first."
    exit 1
fi

# 1. Magic-link → user JWT
curl -fsS -X POST "$API/v1/auth/magic-link" -H 'Content-Type: application/json' \
     -d "{\"email\":\"$EMAIL\"}" >/dev/null
sleep 0.4
if [ ! -f "$LOG" ]; then
    echo "ERROR: api log not at $LOG. If API is in foreground, copy the magic-link token manually."
    exit 1
fi
TOK=$(grep -E "MAGIC LINK for $EMAIL" "$LOG" | tail -1 | sed 's/.*token=//')
USER_JWT=$(curl -fsS -X POST "$API/v1/auth/verify" -H 'Content-Type: application/json' \
    -d "{\"token\":\"$TOK\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2. Become supplier (idempotent)
curl -fsS -X POST "$API/v1/suppliers" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $USER_JWT" \
    -d "{\"display_name\":\"$EMAIL\",\"payout_email\":\"$EMAIL\"}" >/dev/null 2>&1 || true

# 3. Mint provisioning token + register worker
NAME="cli-$(date +%s)"
PROV=$(curl -fsS -X POST "$API/v1/workers/provisioning-tokens" \
    -H 'Content-Type: application/json' -H "Authorization: Bearer $USER_JWT" \
    -d "{\"name\":\"$NAME\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['provisioning_token'])")
WT=$(curl -fsS -X POST "$API/v1/workers/register" -H 'Content-Type: application/json' \
    -d "{\"provisioning_token\":\"$PROV\",\"machine_info\":{}}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['worker_token'])")

cat <<EOF

✔ worker token minted for $EMAIL (worker name: $NAME)

Paste into the shell where you'll run the worker:

    export CLAW_API_URL=$API
    export CLAW_WORKER_TOKEN=$WT
    make worker-run
EOF
