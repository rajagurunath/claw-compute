# Inference Runbook

## Why MLX
- 20-40% faster than llama.cpp on Apple Silicon for autoregressive generation.
- 3× faster on MoE models (Qwen3-Coder-30B-A3B benchmark: 130 tok/s MLX vs 43 tok/s Ollama).
- Hardware-tuned for M5 Neural Accelerators (Apple ML Research, Jan 2026): 4.06× faster TTFT vs M4.

## Default Model
`mlx-community/Qwen3.5-7B-Instruct-4bit` — ~5 GB on disk, ~9 GB peak RAM, runs interactively on a 16 GB M-series Mac.

## Supported Models (v1 catalog)

| ID | HF repo | Size on disk | Min RAM |
|---|---|---|---|
| `qwen` (default) | `mlx-community/Qwen3.5-7B-Instruct-4bit` | 5 GB | 16 GB |
| `gemma` | `mlx-community/gemma-3-12b-it-4bit` | 8 GB | 24 GB |
| `qwen-30b` | `mlx-community/Qwen3.5-30B-A3B-Instruct-4bit` | 17 GB | 36 GB |
| `qwen-72b` | `mlx-community/Qwen3.5-72B-Instruct-4bit` | 40 GB | 64 GB |

The catalog itself lives in `worker/src/inference/models.rs::CATALOG`.

## Manual Test

```bash
# Ensure mlx-lm is installed
uv tool install --upgrade mlx-lm

# Start the server (downloads weights on first run)
uv tool run --from mlx-lm mlx_lm.server \
    --model mlx-community/Qwen3.5-7B-Instruct-4bit \
    --host 127.0.0.1 --port 9000 &
SERVER_PID=$!

# Wait for the server to be ready (model load can take 30-90s)
until curl -fsS http://127.0.0.1:9000/v1/models >/dev/null 2>&1; do sleep 2; done

# Hit it
curl -s http://127.0.0.1:9000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen","messages":[{"role":"user","content":"reply with PONG"}]}' \
  | jq -r '.choices[0].message.content'

kill $SERVER_PID
```

## Adding a Model

1. Pick an MLX-quantised model from <https://huggingface.co/mlx-community>.
2. Add an entry to `worker/src/inference/models.rs::CATALOG` with `id`, `hf_repo`, `min_ram_gb`, `disk_gb`.
3. Bump worker minor version in `worker/Cargo.toml`.
4. Submit PR; reviewer verifies the model loads on a 16 GB and a 64 GB Mac.

## Troubleshooting

- **OOM during load.** mlx-lm preloads weights into unified memory; check `vm_stat` for free pages. Drop to a 4-bit / smaller model.
- **Slow first token.** Model loads lazily on first request; warm it up with a 1-token prompt before exposing to consumers.
- **Wrong outputs / role tags in response.** Check the chat template — mlx-lm uses the HF tokenizer chat template by default. Some quantised repos miss it; pin to a community repo with `tokenizer_config.json`.
- **`uv tool run` hangs.** Ensure `~/.local/bin` is on PATH; mlx-lm depends on platform-specific Metal libs that uv installs the first time.
- **Model download stuck behind a captive portal.** Set `HF_HUB_OFFLINE=1` after pre-downloading via a different network, or use `huggingface-cli download`.
