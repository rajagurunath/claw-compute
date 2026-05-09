# Ralph State

STATUS: in_progress

## Current
plan: 1
task: 8
step: 1

## Completed
- bootstrap (commit 1e0756b)
- plan-1/task-1 (commit 61573c6)
- plan-1/task-2 (commit 22796e1)
- plan-1/task-3 (commit ffc88e4)
- plan-1/task-4 (commit 086017e)
- plan-1/task-5 (commit 9bffe76)
- plan-1/task-6 (commit 10f70d0)
- plan-1/task-7 (commit 947ef62)

## Blocked
(none)

## Notes
- Plan 1 Tasks 1-7 done. Backend now has auth, suppliers, offerings (CRUD + browse), workers (provisioning-token → worker-JWT, heartbeat). 17 tests green.
- 2026-05-10 iter 8 — Plan 1 Task 7: workers table (FK→suppliers, JSON machine_info, status enum), encode_worker_token + current_worker dep, POST /v1/workers/provisioning-tokens, POST /v1/workers/register (one-time use, hash wiped on success), POST /v1/workers/heartbeat (worker JWT auth), GET /v1/suppliers/me/workers. Migration b7784fb3025e applied.
- Next: Plan 1 Task 8 (Heartbeat history — append heartbeat rows for time-series scoring later).
