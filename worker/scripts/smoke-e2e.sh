#!/usr/bin/env bash
# Manual end-to-end smoke test.
# Confirms: marketplace API reachable → agent image present → mlx-lm
# starts → sandbox boots → /health → /v1/chat/completions answers.
#
# Run after `./worker/scripts/bootstrap-host-deps.sh`.
set -euo pipefail

API_URL="${CLAW_API_URL:-http://localhost:8000}"
SANDBOX_NAME="${SANDBOX_NAME:-claw-smoke}"
HOST_PORT="${HOST_PORT:-18080}"
MLX_PORT="${MLX_PORT:-9000}"
MODEL="${MODEL:-mlx-community/Qwen3.5-7B-Instruct-4bit}"

# Pick the sandbox runtime: Apple `container` if available, else docker (Lima
# context or Docker Desktop on older macOS).
if command -v container >/dev/null 2>&1; then
    SBX=container
else
    SBX=docker
fi

cleanup() {
    echo "→ Cleaning up"
    [[ -n "${MLX_PID:-}" ]] && kill "$MLX_PID" 2>/dev/null || true
    "$SBX" stop "$SANDBOX_NAME" 2>/dev/null || true
    "$SBX" rm "$SANDBOX_NAME" 2>/dev/null || true
}
trap cleanup EXIT

echo "→ Sandbox runtime: $SBX"
echo "→ Checking marketplace API at $API_URL"
curl -fsS "$API_URL/v1/health" >/dev/null
echo "  ✔ API up"

echo "→ Ensuring agent image exists (rebuilds if missing)"
"$(dirname "$0")/../../agent-image/build.sh"

echo "→ Starting mlx-lm server on port $MLX_PORT"
uv tool run --from mlx-lm mlx_lm.server \
    --model "$MODEL" \
    --host 127.0.0.1 --port "$MLX_PORT" \
    >/tmp/claw-mlx-lm.log 2>&1 &
MLX_PID=$!

echo "→ Waiting for mlx-lm to come up (model download may take 60-300s on first run)"
for _ in {1..120}; do
    if curl -fsS "http://127.0.0.1:$MLX_PORT/v1/models" >/dev/null 2>&1; then
        break
    fi
    sleep 5
done
curl -fsS "http://127.0.0.1:$MLX_PORT/v1/models" >/dev/null
echo "  ✔ mlx-lm ready"

echo "→ Starting sandbox '$SANDBOX_NAME'"
"$SBX" run -d --name "$SANDBOX_NAME" \
    --mount type=bind,source=/dev/null,target=/etc/claw.json \
    -p "$HOST_PORT:8080" \
    claw/agent-base:latest >/dev/null

echo "→ Waiting for agent runtime"
for _ in {1..30}; do
    if curl -fsS "http://127.0.0.1:$HOST_PORT/health" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
HEALTH=$(curl -fsS "http://127.0.0.1:$HOST_PORT/health")
echo "  ✔ agent runtime: $HEALTH"

echo "→ Calling chat endpoint via sandbox"
RESPONSE=$(curl -fsS "http://127.0.0.1:$HOST_PORT/v1/chat/completions" \
    -H 'Content-Type: application/json' \
    -d '{"messages":[{"role":"user","content":"reply with the single word PONG"}]}')
echo "$RESPONSE" | python3 -c "import json,sys; r=json.load(sys.stdin); print('  ✔ assistant:', r['choices'][0]['message']['content'].strip()[:120])"

echo
echo "✔ E2E smoke complete"
