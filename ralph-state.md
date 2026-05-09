# Ralph State

STATUS: in_progress

## Current
plan: 6
task: 11
step: 1

## Completed
- bootstrap (commit 1e0756b)
- plan-1 (last: 2747674)
- plan-1/followup-ws (commit 00d209b)
- plan-4/task-12 (commit b89b1d0)
- plan-2 (last: 577b348)
- plan-6/task-1..7 (last: afe1823)
- plan-6/amendment-A (commit ea98547)
- plan-6/task-8..10 (last: c0dc8b5)
- plan-6/amendment-B (commit 53648c1)

## Blocked
(none)

## Notes
- 2026-05-10 iter 34 — Plan 6 amendment §3.B done. Frontend deployable to Vercel with OR without backend.
  - lib/seed.ts: 6 seed offerings (varied chips/regions/tags, $0.30-$3.50/hr, stable seed-* ids).
  - lib/safe-api.ts: safeGet<T> — falls back on network/5xx, 4xx propagates.
  - /browse uses safeGet (filters seed list by capability when API down).
  - /offerings/[id] falls through API → findSeedOffering(id) → notFound().
  - /auth/login shows "public preview" Info alert + disables form when !NEXT_PUBLIC_API_URL.
  - web/vercel.json + docs/vercel-deploy.md (project setup + smoke + flip-on flow).
  - Verified: `NEXT_PUBLIC_API_URL='' pnpm build` succeeds; `next start` confirmed /browse and /offerings/seed-* render seed data.
- Next: Plan 6 Task 11 (Polish — not-found + error boundary).
