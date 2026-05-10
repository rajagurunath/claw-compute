#!/usr/bin/env bash
# Drive the worker end-to-end via the marketplace API as a consumer.
#
# Subcommands:
#   start  EMAIL [MESSAGE] [OFFERING_ID]  -- hire an offering, transition to active,
#                                            send a chat message. Prints BOOKING_ID.
#   chat   EMAIL BOOKING_ID MESSAGE       -- send another chat message.
#   cancel EMAIL BOOKING_ID               -- cancel the booking (worker tears down).
#   show   EMAIL BOOKING_ID               -- print the message thread.
#
# All commands are idempotent; the user is auto-created on first magic-link.
# Requires `make up` (background mode) so the api log file exists, OR pass
# CLAW_API_LOG=/path/to/api.log if you tee'd `make api` output somewhere.
set -euo pipefail

CMD="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${CLAW_API_URL:-http://localhost:8000}"
LOG="${CLAW_API_LOG:-$ROOT/.logs/api.log}"

usage() {
    sed -n '2,12p' "$0" | sed 's/^# \?//'
    exit 1
}

[ -z "$CMD" ] && usage

if ! curl -fsS "$API/v1/health" >/dev/null 2>&1; then
    echo "ERROR: API not reachable at $API. Run 'make api' or 'make up' first." >&2
    exit 1
fi

mint_jwt() {
    local email=$1
    if [ ! -f "$LOG" ]; then
        echo "ERROR: api log not at $LOG (set CLAW_API_LOG, or run via 'make up')." >&2
        exit 1
    fi
    curl -fsS -X POST "$API/v1/auth/magic-link" -H 'Content-Type: application/json' \
         -d "{\"email\":\"$email\"}" >/dev/null
    sleep 0.4
    local tok
    tok=$(grep -E "MAGIC LINK for $email" "$LOG" | tail -1 | sed 's/.*token=//')
    [ -z "$tok" ] && { echo "ERROR: no magic-link for $email in $LOG" >&2; exit 1; }
    curl -fsS -X POST "$API/v1/auth/verify" -H 'Content-Type: application/json' \
         -d "{\"token\":\"$tok\"}" \
         | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])"
}

pick_offering() {
    curl -fsS "$API/v1/offerings" \
        | python3 -c "import sys,json;d=json.load(sys.stdin)['items'];print(d[0]['id'] if d else '')"
}

pick_worker_for() {
    local offering_id=$1
    curl -fsS "$API/v1/offerings/$offering_id" 2>/dev/null \
        | python3 -c "import sys,json;
d=json.load(sys.stdin)
print(d.get('workers',[{}])[0].get('id','') if d.get('workers') else '')" 2>/dev/null \
        || echo ""
}

case "$CMD" in
    start)
        EMAIL="${2:?usage: demo-flow.sh start EMAIL [MESSAGE] [OFFERING_ID]}"
        MSG="${3:-Hello! Are you up and running?}"
        OFFERING="${4:-$(pick_offering)}"
        [ -z "$OFFERING" ] && { echo "no offerings exist — run 'make seed-demo' first" >&2; exit 1; }

        echo "▸ minting JWT for $EMAIL"
        JWT=$(mint_jwt "$EMAIL")
        echo "▸ hiring offering $OFFERING"

        # Try with worker_id; fall back to plain hire if unavailable.
        WID=$(pick_worker_for "$OFFERING")
        if [ -n "$WID" ]; then
            BODY="{\"offering_id\":\"$OFFERING\",\"worker_id\":\"$WID\"}"
        else
            BODY="{\"offering_id\":\"$OFFERING\"}"
        fi
        BID=$(curl -fsS -X POST "$API/v1/bookings" -H 'Content-Type: application/json' \
            -H "Authorization: Bearer $JWT" -d "$BODY" \
            | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
        echo "  booking_id=$BID"

        echo "▸ transitioning pending → active  (fires booking_activated to worker)"
        curl -fsS -X POST "$API/v1/bookings/$BID/transition" -H 'Content-Type: application/json' \
            -H "Authorization: Bearer $JWT" -d '{"to":"active"}' >/dev/null

        echo "▸ sending chat: \"$MSG\"  (fires message_user to worker)"
        curl -fsS -X POST "$API/v1/bookings/$BID/messages" -H 'Content-Type: application/json' \
            -H "Authorization: Bearer $JWT" -d "{\"content\":$(python3 -c "import sys,json;print(json.dumps(sys.argv[1]))" "$MSG")}" >/dev/null

        cat <<EOF

✔ booking active. Watch Terminal 3 (worker) for the events.

  Send another chat:
    bash scripts/demo-flow.sh chat $EMAIL $BID "your next prompt"

  See the thread:
    bash scripts/demo-flow.sh show $EMAIL $BID

  Cancel (fires booking_cancelled):
    bash scripts/demo-flow.sh cancel $EMAIL $BID

  Browser view:
    http://localhost:3000/dashboard/bookings/$BID
EOF
        ;;

    chat)
        EMAIL="${2:?usage: demo-flow.sh chat EMAIL BID MESSAGE}"
        BID="${3:?missing booking id}"
        MSG="${4:?missing message}"
        JWT=$(mint_jwt "$EMAIL")
        curl -fsS -X POST "$API/v1/bookings/$BID/messages" -H 'Content-Type: application/json' \
            -H "Authorization: Bearer $JWT" -d "{\"content\":$(python3 -c "import sys,json;print(json.dumps(sys.argv[1]))" "$MSG")}" >/dev/null
        echo "✔ sent"
        ;;

    cancel)
        EMAIL="${2:?usage: demo-flow.sh cancel EMAIL BID}"
        BID="${3:?missing booking id}"
        JWT=$(mint_jwt "$EMAIL")
        curl -fsS -X POST "$API/v1/bookings/$BID/transition" -H 'Content-Type: application/json' \
            -H "Authorization: Bearer $JWT" -d '{"to":"cancelled"}' >/dev/null
        echo "✔ cancelled (worker should tear down sandbox)"
        ;;

    show)
        EMAIL="${2:?usage: demo-flow.sh show EMAIL BID}"
        BID="${3:?missing booking id}"
        JWT=$(mint_jwt "$EMAIL")
        curl -fsS "$API/v1/bookings/$BID/messages" -H "Authorization: Bearer $JWT" \
            | python3 -c "import sys,json
d=json.load(sys.stdin)
for m in d.get('items', d if isinstance(d,list) else []):
    who = m.get('role') or m.get('sender') or '?'
    print(f\"[{who}] {m.get('content','')}\")"
        ;;

    *)
        usage
        ;;
esac
