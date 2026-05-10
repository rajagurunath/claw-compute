# Ralph State

STATUS: in_progress

## Current
plan: 5
task: 7
step: 1

## Completed
- bootstrap (commit 1e0756b)
- plan-1 (last: 2747674)
- plan-1/followup-ws (commit 00d209b)
- plan-4/task-12 (commit b89b1d0)
- plan-2 (last: 577b348)
- plan-6 (last: 6b0b3cb)
- plan-5/task-1..5 (last: df4afff)
- plan-5/task-6 (commit 14fdb63)

## Blocked
(none)

## Notes
- 2026-05-10 iter 41 — Plan 5 Task 6 done.
  - LimaBackend: detect via limactl on PATH; ensure_vm() creates template://docker VM if missing; start writes shell-escaped /etc/claw.json then docker-in-VM run; stop/is_running shell out to docker inside the VM.
  - registry::auto() chains container → lima → noop. main.rs uses auto() when CLAW_SANDBOX_BACKEND unset.
  - 3 new unit tests (shell_escape: basic + with quote; lima_sandbox_name dash-stripping).
  - On this host (macOS 15.6 with limactl 2.1.1), `auto()` will now select LimaBackend.
- 11 lib + 3 booking_lifecycle + 2 register + 1 gated container_smoke = 17 worker tests, all green.
- Next: Plan 5 Task 7 (Booking → Sandbox → Inference wiring documentation — final task in Plan 5).
