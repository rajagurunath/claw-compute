# Ralph State

STATUS: in_progress

## Current
plan: 6
task: 4
step: 1

## Completed
- bootstrap (commit 1e0756b)
- plan-1 (last: 2747674)
- plan-1/followup-ws (commit 00d209b)
- plan-4/task-12 (commit b89b1d0)
- plan-2 (last: 577b348)
- plan-6/task-1 (commit 4167c51)
- plan-6/task-2 (commit 32b0d4c)
- plan-6/task-3 (commit e9b9c31)

## Blocked
(none)

## Notes
- 2026-05-10 iter 25 — Plan 6 Task 3 done. Magic-link auth wired.
  - actions.ts: requestMagicLink (zod-validated, returns AuthState), verifyMagicLink (exchanges token, sets 24h httpOnly cookie, redirects to /dashboard).
  - /auth/login page uses React 19 useActionState (renamed from useFormState).
  - /auth/verify is an async RSC that consumes ?token= and delegates.
  - /auth/logout is a POST route that clears the cookie.
  - Plan said useFormState — adapted to React 19's useActionState (same shape, moved to react package).
- pnpm build green; routes registered: /, /auth/login (static), /auth/logout (dynamic), /auth/verify (dynamic).
- Next: Plan 6 Task 4 (Marketing landing page — Hero, Features, SupplierCTA).
