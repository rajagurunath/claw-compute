# Ralph State

STATUS: in_progress

## Current
plan: 5
task: 6
step: 1

## Completed
- bootstrap (commit 1e0756b)
- plan-1 (last: 2747674)
- plan-1/followup-ws (commit 00d209b)
- plan-4/task-12 (commit b89b1d0)
- plan-2 (last: 577b348)
- plan-6 (last: 6b0b3cb)
- plan-5/task-1..4 (last: fe7d17d)
- plan-5/task-5 (commit df4afff)

## Blocked
(none)

## Notes
- 2026-05-10 iter 40 — Plan 5 Task 5 done.
  - smoke-e2e.sh: API health → agent image build (delegates to agent-image/build.sh) → mlx-lm spawn → sandbox run → /health → /v1/chat/completions → cleanup via trap. Auto-picks Apple `container` vs docker. Pretty-prints assistant reply via python3 -c json. bash -n syntax-clean.
  - sandbox-runbook.md: 7 troubleshooting recipes (`container` missing, host.containers.internal DNS, connection refused, disk-full, sandbox-never-starts, model load issues, WS reconnect loop).
- Next: Plan 5 Task 6 (Lima fallback backend for macOS 14/15 hosts).
