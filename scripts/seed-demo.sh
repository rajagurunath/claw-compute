#!/usr/bin/env bash
# Seed a demo dataset against a running API on localhost:8000.
#
# Creates: 1 supplier (Demo Studios) with 3 offerings, 1 worker with one
# heartbeat, 1 consumer with an active booking + 4-message chat thread.
# Prints magic-link verify URLs for both roles at the end.
set -euo pipefail

API="${CLAW_API_URL:-http://localhost:8000}"
LOG="${1:-${ROOT:-$(dirname "$0")/..}/.logs/api.log}"

if ! curl -fsS "$API/v1/health" >/dev/null 2>&1; then
    echo "ERROR: API not reachable at $API. Run 'make api' (or 'make up') first."
    exit 1
fi

mint_token() {
    local email=$1
    curl -fsS -X POST "$API/v1/auth/magic-link" -H 'Content-Type: application/json' \
         -d "{\"email\":\"$email\"}" >/dev/null
    sleep 0.3
    if [ -f "$LOG" ]; then
        grep -E "MAGIC LINK for $email" "$LOG" | tail -1 | sed 's/.*token=//'
    else
        # fallback: API in foreground — caller has to copy the token themselves
        echo "(magic-link issued for $email — token in api foreground log)"
    fi
}

ts=$(date +%s)
SUP_EMAIL="demo-supplier-$ts@claw.dev"
CON_EMAIL="demo-consumer-$ts@claw.dev"

# === supplier ===
TOK=$(mint_token "$SUP_EMAIL")
SUP_JWT=$(curl -fsS -X POST "$API/v1/auth/verify" -H 'Content-Type: application/json' \
    -d "{\"token\":\"$TOK\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -fsS -X POST "$API/v1/suppliers" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $SUP_JWT" \
    -d '{"display_name":"Demo Studios","payout_email":"pay@demo.dev"}' >/dev/null

for o in \
  '{"title":"Mac Studio M3 Max · 64 GB","description":"Dedicated machine, MLX-tuned, Qwen 7B preloaded.","price_per_hour_cents":180,"capability_tags":["macos","mlx","m3-max","qwen"]}' \
  '{"title":"MacBook Pro M3 Pro · 36 GB","description":"Always-on, fibre, EU-West.","price_per_hour_cents":120,"capability_tags":["macos","mlx","m3-pro","eu-west"]}' \
  '{"title":"Mac mini M4 · 24 GB","description":"Budget tier. Gemma 3 12B comfortable.","price_per_hour_cents":50,"capability_tags":["macos","mlx","m4","gemma","budget"]}'; do
    curl -fsS -X POST "$API/v1/offerings" -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $SUP_JWT" -d "$o" >/dev/null
done

PROV=$(curl -fsS -X POST "$API/v1/workers/provisioning-tokens" \
    -H 'Content-Type: application/json' -H "Authorization: Bearer $SUP_JWT" \
    -d '{"name":"demo-mac-studio"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['provisioning_token'])")
WT=$(curl -fsS -X POST "$API/v1/workers/register" -H 'Content-Type: application/json' \
    -d "{\"provisioning_token\":\"$PROV\",\"machine_info\":{\"chip\":\"Apple M3 Max\",\"total_ram_gb\":64.0}}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['worker_token'])")
curl -fsS -X POST "$API/v1/workers/heartbeat" -H "Authorization: Bearer $WT" \
    -H 'Content-Type: application/json' \
    -d '{"cpu_pct":12.5,"mem_pct":40.0,"free_ram_gb":36.5}' >/dev/null

# === consumer + active booking + chat ===
TOK2=$(mint_token "$CON_EMAIL")
CON_JWT=$(curl -fsS -X POST "$API/v1/auth/verify" -H 'Content-Type: application/json' \
    -d "{\"token\":\"$TOK2\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

OFFERING=$(curl -fsS "$API/v1/offerings" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print([o['id'] for o in d['items'] if 'M3 Max' in o['title']][0])")
WORKER=$(curl -fsS -H "Authorization: Bearer $SUP_JWT" "$API/v1/suppliers/me/workers" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['items'][0]['id'])")

BID=$(curl -fsS -X POST "$API/v1/bookings" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $CON_JWT" \
    -d "{\"offering_id\":\"$OFFERING\",\"worker_id\":\"$WORKER\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -fsS -X POST "$API/v1/bookings/$BID/transition" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $SUP_JWT" -d '{"to":"active"}' >/dev/null

curl -fsS -X POST "$API/v1/bookings/$BID/messages" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $CON_JWT" -d '{"content":"Hi! Are you up and running?"}' >/dev/null
curl -fsS -X POST "$API/v1/bookings/$BID/messages/internal" -H "Authorization: Bearer $WT" \
    -H 'Content-Type: application/json' \
    -d '{"content":"All good — Qwen 7B is warm and ready. Ask me anything."}' >/dev/null

# Mint fresh magic-link tokens for the actual sign-in (the ones above are
# already consumed by curl).
SUP_FRESH=$(mint_token "$SUP_EMAIL")
CON_FRESH=$(mint_token "$CON_EMAIL")

cat <<EOF

╔════════════════════════════════════════════════════════════════════════╗
║  ✔  Demo seeded                                                        ║
╚════════════════════════════════════════════════════════════════════════╝

Supplier sign-in (browser window 1):
  http://localhost:3000/auth/verify?token=$SUP_FRESH

Consumer sign-in (browser window 2 / incognito):
  http://localhost:3000/auth/verify?token=$CON_FRESH

After verifying:
  • Supplier: /dashboard/suppliers/{workers,offerings}
  • Consumer: /browse, /dashboard/bookings/$BID

Booking id (consumer's chat thread): $BID
EOF
