# Ralph State

STATUS: in_progress

## Current
plan: 1
task: 5
step: 1

## Completed
- bootstrap (commit 1e0756b)
- plan-1/task-1 (commit 61573c6)
- plan-1/task-2 (commit 22796e1)
- plan-1/task-3 (commit ffc88e4)
- plan-1/task-4 (commit 086017e)

## Blocked
(none)

## Notes
- 2026-05-10 iter 1 — Bootstrap + sanity. Lima/container deferred to Plan 5 Task 1.
- 2026-05-10 iter 2 — Plan 1 Task 1: FastAPI scaffold, /v1/health green.
- 2026-05-10 iter 3 — Plan 1 Task 2: Postgres (image: postgres:15 cached) + Alembic.
- 2026-05-10 iter 4 — Plan 1 Task 3: async DB fixtures (conftest), test_health migrated to async.
- 2026-05-10 iter 5 — Plan 1 Task 4: users + magic_link_tokens models, argon2 hashing, JWT (HS256), magic-link service, deps.current_user, /v1/auth/{magic-link,verify}, /v1/me. Migration 047af4ab3cfa applied. 5 tests green.
  - Fix during this task: added `asyncio_default_fixture_loop_scope = "session"` and `asyncio_default_test_loop_scope = "session"` to pyproject.toml — pytest-asyncio v1.x defaults caused asyncpg "Future attached to a different loop" errors with session-scoped engine.
  - Cosmetic: JWT_SECRET placeholder is 31 bytes; logs InsecureKeyLengthWarning. Production sets a longer secret.
- Next: Plan 1 Task 5 (Suppliers — supplier registration + /v1/suppliers/me).
