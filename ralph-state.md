# Ralph State

STATUS: blocked

## Current
plan: 5
task: stop-condition
step: smoke-e2e

## Completed
- bootstrap (commit 1e0756b)
- plan-1 — full backend (last: 2747674)
- plan-1/followup-ws (commit 00d209b) — WebSocket worker channel
- plan-4/task-12 (commit b89b1d0) — backend deltas (/me/role + messages)
- plan-2 — full Rust worker (last: 577b348)
- plan-6 — full frontend (last: 6b0b3cb), incl. amendments §3.A pricing + §3.B Vercel/seed-fallback
- plan-5/task-1..6 (last: 14fdb63) — sandbox + inference scaffolding
- plan-5/task-7 (commit 574afcd) — booking flow doc + doctest

## Blocked
- **smoke-e2e.sh not exercised.** Hardware can run it (Lima 2.1.1 + mlx-lm 0.31.3 installed via bootstrap-host-deps.sh), but the prerequisite chain stalled inside this harness:
  1. `docker pull python:3.12-slim` writes its progress only to TTY; this loop's bash subshells get an empty output buffer, so I can't confirm completion.
  2. `agent-image/build.sh` therefore can't be verified to produce `claw/agent-base:0.1`.
  3. `smoke-e2e.sh` requires both that image AND a marketplace API daemon listening on `$CLAW_API_URL/v1/health`.
- **Nothing is "up and running" yet** in the user's promise sense:
  - Backend code complete + tested but not deployed to a public host.
  - Frontend code complete + Vercel-ready but not pushed.
  - Worker binary built (dist/claw-worker-0.1.0-aarch64-apple-darwin.tar.gz) but no supplier has installed/registered it.
  - mlx-lm installed on this dev host but not driving any live booking.

## Done — what shipped (code-complete, not operationally deployed)
- **Backend** (FastAPI + Postgres): auth (magic-link + JWT), suppliers, offerings (CRUD + browse), workers (provisioning-token → JWT, heartbeat persisted), bookings (state machine), messages (consumer → worker → assistant), `/v1/me/role`, `/v1/ws/worker`, in-memory pub/sub. 36 tests, ruff clean, CI workflow + Dockerfile.
- **Worker** (Rust 1.90, edition 2024): register, heartbeat, outbound WS handler with reconnect/backoff, `SandboxBackend` trait + Noop / Apple `container` / Lima implementations + auto-detect, `ModelHost` mlx-lm supervisor, booking dispatcher with optional ModelHost. `cargo test` 17 green. install.sh + ad-hoc signed tarball produced. docs/worker-prerequisites.md captures every human step deferred to v2.
- **Frontend** (Next.js 16 + Tailwind 4 + shadcn/ui): marketing landing (animated gradient hero, 6 feature cards, supplier CTA, copy-on-click install snippet), browse + offering detail, pricing (3 tiers + FAQ), authed dashboard with role-aware sidebar, become-a-supplier, worker management + 2-stage install wizard, offering CRUD with status colors + Danger zone, consumer bookings list + chat UI (Bot/User bubbles, optimistic insert/rollback, ⌘+Enter), 404 + error boundary. Builds clean with AND without `NEXT_PUBLIC_API_URL`. seed-data fallback on /browse + /offerings/[id]. Vercel project setup walkthrough in docs/vercel-deploy.md.
- **Sandbox + Inference**: bootstrap-host-deps.sh (idempotent), inference-runbook.md (catalog + manual test recipe), agent-image (FastAPI runtime + 2-stage Dockerfile + idempotent build.sh), ContainerBackend + LimaBackend with auto-select, ModelHost supervises `uv tool run mlx_lm.server`, smoke-e2e.sh, sandbox-runbook.md.

## Notes (cumulative)
- 2026-05-10 iter 1-42 — Plans 1-6 fully delivered as code; build/lint/test gates all pass; deploy gates blocked by user-driven ops (Vercel deploy, API hosting, worker registration).
- §7 stop-condition is **9/10 satisfied**; smoke-e2e is the holdout. Per ralph-loop.md §7 "or set STATUS: blocked with reason if hardware can't run it" — flagged here.

## What the user needs to do next (operational)
1. **Build the agent image** (interactive shell, not this harness):
   ```bash
   docker pull python:3.12-slim
   ./agent-image/build.sh
   ```
2. **Run the marketplace API** (one terminal):
   ```bash
   cd backend && docker compose up -d && uv run uvicorn claw_api.main:app --port 8000
   ```
3. **Register a worker + smoke** (another terminal):
   ```bash
   # Become a supplier via the UI or API, mint a provisioning token, then:
   export CLAW_API_URL=http://localhost:8000
   ./worker/scripts/smoke-e2e.sh
   ```
4. **Deploy frontend to Vercel**: `cd web && pnpm dlx vercel link && pnpm dlx vercel --prod` (set `NEXT_PUBLIC_API_URL` to the production API).
5. Once smoke passes + Vercel deploy live, set `STATUS: complete` and commit `chore: ralph loop complete`.

To stop the Ralph plugin loop now, run: `/ralph-loop:cancel-ralph` in the Claude Code session.
