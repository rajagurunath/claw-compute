# Ralph State

STATUS: in_progress

## Current
plan: 5
task: 5
step: 1

## Completed
- bootstrap (commit 1e0756b)
- plan-1 (last: 2747674)
- plan-1/followup-ws (commit 00d209b)
- plan-4/task-12 (commit b89b1d0)
- plan-2 (last: 577b348)
- plan-6 (last: 6b0b3cb)
- plan-5/task-1..3 (last: f39ac18)
- plan-5/task-4 (commit fe7d17d)

## Blocked
(none)

## Notes
- 2026-05-10 iter 39 — Plan 5 Task 4 done.
  - inference/{mod,models}.rs: CATALOG (qwen/gemma/qwen-30b), ModelHost::ensure_loaded (idempotent — same model+port = no-op; otherwise kill previous + spawn `uv tool run mlx_lm.server`).
  - BookingHandler.with_model_host(host) builder; on BookingActivated, resolves model_id from agent_config (default "qwen") and calls ensure_loaded BEFORE sandbox start. Degrades gracefully on failure.
  - main.rs::run_loop: pre-warms default model in fire-and-forget tokio::spawn.
  - 3 new catalog unit tests. 8 lib + 3 booking_lifecycle + 2 register + 1 gated smoke = 14 tests, all green.
- Next: Plan 5 Task 5 (E2E smoke script worker/scripts/smoke-e2e.sh + sandbox runbook).
