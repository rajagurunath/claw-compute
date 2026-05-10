# Ralph State

STATUS: in_progress

## Current
plan: 5
task: 4
step: 1

## Completed
- bootstrap (commit 1e0756b)
- plan-1 (last: 2747674)
- plan-1/followup-ws (commit 00d209b)
- plan-4/task-12 (commit b89b1d0)
- plan-2 (last: 577b348)
- plan-6 (last: 6b0b3cb)
- plan-5/task-1..2 (last: 670ab90)
- plan-5/task-3 (commit f39ac18)

## Blocked
(none)

## Notes
- 2026-05-10 iter 38 — Plan 5 Task 3 done. ContainerBackend shells out to Apple `container` CLI; detect/start/stop/is_running implemented. 3 arg-construction unit tests + 2 noop tests = 5 lib tests green. Gated smoke (worker/tests/container_smoke.rs) confirmed skip path works without RUN_CONTAINER_SMOKE=1.
  - Moved `tempfile` + `which` from [dev-dependencies] to [dependencies] for runtime use.
- Note: ContainerBackend itself only works on macOS 26+ (detect() returns Err otherwise → registry falls back to NoopBackend automatically). On this host (15.6) the binding code paths are linted/typechecked but won't be exercised at runtime.
- Next: Plan 5 Task 4 (Worker ModelHost — supervises mlx-lm process on the host).
