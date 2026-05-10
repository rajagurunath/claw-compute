# Sandbox Runbook

## Quick health check

```bash
./worker/scripts/smoke-e2e.sh
```

Tests: marketplace API → agent image build → mlx-lm boot → sandbox run → `GET /health` → `POST /v1/chat/completions`. Cleans up after itself.

## Common issues

### `container` not found
macOS 26 ships Apple's `container` framework. macOS 14/15 use Lima as the fallback. `worker/scripts/bootstrap-host-deps.sh` installs the right one for your host.

### `host.containers.internal` not resolving inside the sandbox
- Apple `container` (macOS 26+): adds this DNS entry automatically.
- Lima fallback: set `inference_base_url` in the consumer's `/etc/claw.json` to the host's bridge IP — typically `http://192.168.5.2:9000/v1` (varies by Lima template).
- Quick check: `container exec <name> getent hosts host.containers.internal`.

### Sandbox can't reach mlx-lm (`Connection refused`)
- For Apple `container`: `host.containers.internal:9000` works because of NAT; mlx-lm bound to `127.0.0.1` is fine.
- For Lima: bind mlx-lm to `0.0.0.0` so the bridge can reach it.
- Confirm mlx-lm is up first: `curl -s http://127.0.0.1:9000/v1/models`.

### Image build hits "no space left on device"
Apple `container` stores images under `~/Library/Containers/com.apple.container/`. Reclaim with:
```bash
container system prune
container image rm $(container image ls -q --filter dangling=true)
```
Docker (Lima context): `docker system prune -a`.

### Booking activated but sandbox never starts
1. Check worker logs (`tail -F ~/.claw/log/*.log` or wherever you piped output).
2. Verify the agent image is present locally: `container images claw/agent-base`.
3. Try the sandbox manually:
   ```bash
   container run --rm claw/agent-base:latest python -c "print('hello')"
   ```
4. Inspect a stuck container: `container inspect claw-<booking-id>`.

### Model fails to load (OOM / wrong template)
See `docs/inference-runbook.md` for model-side troubleshooting (RAM ceilings, chat template fallbacks, captive-portal mitigation).

### Worker keeps reconnecting WS
The marketplace closes the connection if the worker token is invalid (4401) or has been revoked. Re-register by issuing a new provisioning token from the supplier dashboard and running `claw-worker register --provisioning-token <NEW_TOKEN>`.
