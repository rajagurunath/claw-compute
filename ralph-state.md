# Ralph State

STATUS: blocked

## Current
plan: 5
task: stop-condition
step: agent-image-build

## Completed
- bootstrap (commit 1e0756b)
- plan-1 — full backend (last: 2747674)
- plan-1/followup-ws (commit 00d209b) — WebSocket worker channel
- plan-4/task-12 (commit b89b1d0) — backend deltas (/me/role + messages)
- plan-2 — full Rust worker (last: 577b348)
- plan-6 — full frontend (last: 6b0b3cb), incl. amendments §3.A pricing + §3.B Vercel/seed-fallback
- plan-5/task-1..6 (last: 14fdb63) — sandbox + inference scaffolding
- plan-5/task-7 (commit 574afcd) — booking flow doc + doctest
- top-level README + worker-ci + web-ci (commit 36b3579)
- worker --worker-token / CLAW_WORKER_TOKEN env override (commit a945f03)

## Partial smoke evidence captured this iteration
Started API on :8765, registered a worker via the binary, ran with --worker-token override:
- ✅ `sandbox backend selected backend="lima"` — Lima auto-detected
- ✅ `launching mlx-lm server model=qwen repo=mlx-community/Qwen3.5-7B-Instruct-4bit port=9000`
- ✅ `ws connected` to /v1/ws/worker
- ✅ heartbeats table: 2 rows after 18s (initial + 15s tick)

This proves the API ↔ worker plane works end-to-end on this macOS 15.6 host. What's still untested is the **sandbox-side** path (agent-image → /v1/chat/completions through the sandbox), because the agent image isn't built locally yet.

## Blocked
- **`agent-image/build.sh` not run locally.** Hardware can run it (Lima 2.1.1 + Docker Desktop are present), but `docker pull python:3.12-slim` hangs silently in this harness's bash subshells. The harness drops Docker's TTY-targeted progress output, so I can't watch the pull or confirm it lands. Manual fix: open a regular shell and run `docker pull python:3.12-slim` (or use Lima's docker context: `lima nerdctl pull python:3.12-slim`), then `./agent-image/build.sh`.
- **Nothing is publicly deployed.** The user's promise text "all apps should be up and running" requires:
  - Frontend: `cd web && pnpm dlx vercel --prod`
  - Backend: deploy `backend/Dockerfile` to a host (Fly / Render / Railway / etc.) and update DNS
  - Supplier: install `dist/claw-worker-0.1.0-aarch64-apple-darwin.tar.gz` on a Mac and register

## Done — what shipped (code-complete, builds + tests + lint pass)
- **Backend** (FastAPI + Postgres): 36 pytest tests green, ruff clean, CI workflow, Dockerfile.
- **Worker** (Rust 1.90, edition 2024): 18 tests green (incl. 1 doctest), release build for aarch64-apple-darwin (3.6MB tarball with ad-hoc codesign), end-to-end smoke against live API verified.
- **Frontend** (Next.js 16 + Tailwind 4 + shadcn/ui): builds clean WITH and WITHOUT NEXT_PUBLIC_API_URL set; seed-data fallback; CI workflow exercises both build modes.
- **Sandbox + Inference**: bootstrap script verified on this host (Lima 2.1.1 + mlx-lm 0.31.3 installed); ContainerBackend + LimaBackend + auto-select; ModelHost confirmed launching mlx-lm correctly.

## §7 stop-condition: 9.5/10 satisfied

| Check | Status |
|---|---|
| All plan tasks `- [x]` | ✅ |
| Amendments §3.A + §3.B applied | ✅ |
| `pnpm build` with API | ✅ |
| `pnpm build` without API | ✅ |
| `pytest -v` green | ✅ 36 pass |
| `cargo test` green | ✅ 18 pass |
| `cargo build --release --target aarch64-apple-darwin` | ✅ |
| `smoke-e2e.sh` green | ⚠️ partial — API↔worker plane verified live; sandbox side blocked on agent-image build |
| `git status` clean | ✅ (after this commit) |
| Final `chore: ralph loop complete` | ❌ — would be a false promise without operational deploy |

## Next concrete action for the user

```bash
# 1. Build agent image (interactive shell, not this harness)
docker pull python:3.12-slim
./agent-image/build.sh

# 2. Optional: full e2e smoke
cd backend && uv run uvicorn claw_api.main:app --port 8000 &
./worker/scripts/smoke-e2e.sh

# 3. Deploy frontend
cd web && pnpm dlx vercel --prod

# 4. Cancel the Ralph loop
/ralph-loop:cancel-ralph
```

To stop the Ralph plugin loop *now* without deploying: `/ralph-loop:cancel-ralph`.
