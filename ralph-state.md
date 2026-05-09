# Ralph State

STATUS: in_progress

## Current
plan: 5
task: 2
step: 1

## Completed
- bootstrap (commit 1e0756b)
- plan-1 (last: 2747674)
- plan-1/followup-ws (commit 00d209b)
- plan-4/task-12 (commit b89b1d0)
- plan-2 (last: 577b348)
- plan-6 (last: 6b0b3cb)
- plan-5/task-1 (commit 919bcc4)

## Blocked
(none)

## Notes
- 2026-05-10 iter 36 — Plan 5 Task 1 done.
  - bootstrap-host-deps.sh idempotent: detects macOS 26 (Apple container) vs older (Lima); installs uv, then mlx-lm via `uv tool install --upgrade mlx-lm`.
  - Verified on macOS 15.6 (this host): brew install lima → limactl 2.1.1; uv tool install mlx-lm → mlx-lm 0.31.3 + 17 mlx_lm.* executables.
  - inference-runbook.md: rationale, model catalog, manual test recipe with health-check polling, troubleshooting.
- Next: Plan 5 Task 2 (Agent base image — claw/agent-base FastAPI runtime + Dockerfile + build.sh).
