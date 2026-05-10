# Claw Marketplace

Hire idle Apple Silicon Macs by the hour. Suppliers install one binary; consumers get a sandboxed agent backed by local MLX inference.

This is the v1 implementation of the marketplace described in [`plan.md`](./plan.md). It ships under a documented "Trust-but-verify" threat model — see [`docs/security-analysis.md`](./docs/security-analysis.md).

## Repo layout

| Path | What it is |
|---|---|
| [`backend/`](./backend) | FastAPI + Postgres marketplace API |
| [`worker/`](./worker) | Rust worker binary (macOS / Apple Silicon) |
| [`agent-image/`](./agent-image) | OCI image (Python + FastAPI) that runs inside each booking's sandbox |
| [`web/`](./web) | Next.js 16 frontend (deployable to Vercel with or without backend) |
| [`docs/`](./docs) | Plans, runbooks, security analysis, vercel-deploy guide |
| [`docs/superpowers/plans/`](./docs/superpowers/plans) | The four implementation plans the build follows |

## Quick start (developer)

Install host deps once (idempotent — installs Lima on macOS 14/15, Apple `container` is expected to be already present on macOS 26+):

```bash
./worker/scripts/bootstrap-host-deps.sh
```

Bring up the backend:

```bash
cd backend
docker compose up -d            # Postgres
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn claw_api.main:app --reload --port 8000
```

Run the frontend:

```bash
cd web
pnpm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
pnpm dev
```

The frontend works **without** the backend running too — the public surface (`/`, `/browse`, `/pricing`, `/offerings/[id]`) falls back to seed data; the auth + dashboard flows show a "marketplace not yet live" notice. See [`docs/vercel-deploy.md`](./docs/vercel-deploy.md).

Run the worker against your local API:

```bash
# Become a supplier in the UI (or via curl), grab a provisioning token:
export CLAW_API_URL=http://localhost:8000
export CLAW_PROVISIONING_TOKEN=<from supplier dashboard>
cd worker && cargo run -- register
cd worker && cargo run -- run
```

## Test suites

```bash
cd backend && uv run pytest -v          # 36 tests
cd worker  && cargo test                 # 17 tests
cd web     && pnpm build                 # type-check + production build
```

CI runs the same gates on every PR — see `.github/workflows/`.

## Architecture references

- [`docs/security-analysis.md`](./docs/security-analysis.md) — what we DO and DO NOT claim under v1, why we copied Darkbloom's reachability pattern but not their TEE/MDM stack
- [`docs/network-and-orchestration.md`](./docs/network-and-orchestration.md) — outbound-only worker pattern + the Temporal decision (skip for v1 worker, use for v1.5 scoring)
- [`docs/inference-runbook.md`](./docs/inference-runbook.md) — MLX rationale + supported model catalog + manual test recipe
- [`docs/sandbox-runbook.md`](./docs/sandbox-runbook.md) — `container` / Lima troubleshooting
- [`docs/worker-prerequisites.md`](./docs/worker-prerequisites.md) — every human step deferred to v2 (Apple Developer enrollment, MDM, ACME, etc.)
- [`docs/vercel-deploy.md`](./docs/vercel-deploy.md) — frontend deployment

## What's deferred

v1 ships **trust-but-verify**:
- ✓ Open-source worker, ad-hoc code-signed binary
- ✓ Outbound-only WebSocket — no inbound port on supplier hardware
- ✓ Magic-link auth, JWT sessions, single-use provisioning tokens
- ✗ Hardened Runtime + Secure Enclave attestation (v2 — see worker-prerequisites)
- ✗ E2E encryption between consumer and sandbox (v2)
- ✗ Stripe payouts (v1.5)
- ✗ OpenClaw / Hermes integration (v2 — agent image variants)

## End-to-end smoke

```bash
docker pull python:3.12-slim    # one-time, base for the agent image
./agent-image/build.sh          # idempotent
# Backend running on :8000, worker registered, mlx-lm tooling installed:
./worker/scripts/smoke-e2e.sh   # API health → mlx-lm boot → sandbox → /v1/chat/completions
```

## Build / orchestration history

`/Users/.../ralph-loop.md` and `ralph-state.md` track the autonomous build that produced this repo. Each iteration commits a single task from the plans; check `git log` for the trail.
