# Ralph Loop — Claw Marketplace

> Standing instruction for the Ralph Loop. Each iteration: read this file + `ralph-state.md`, pick the next un-checked task from the next plan in execution order, complete it via TDD, commit, update state, exit. The loop driver re-runs the agent until `ralph-state.md` reports `STATUS: complete`.

---

## 1. What We're Building

- **Worker binary (macOS, Apple Silicon)** that installs in one curl command, spins up a sandbox + local inference engine, registers with the marketplace, sends heartbeats, and obeys control signals from the marketplace (start/stop bookings, etc.)
- **Marketplace API** (FastAPI + Postgres) that manages supplier offerings, consumer interactions, worker lifecycle, and bookings; exchanges control signals with the worker over an outbound WebSocket.
- **Marketplace frontend** (Next.js 16 on Vercel) — landing, browse, supplier dashboard with worker install wizard + offering CRUD, consumer bookings + chat UI, **pricing page**. Must deploy to Vercel **with or without the backend API ready** — if backend is unreachable, the public pages render from seed data so the marketing site is live before the platform is. [use **frontend-design** skill to create the beautiful, aesthetic, SaaS platform level UI/UX for the marketplace website.]

## Completion criteria (from original brief)

- Worker binary installable + functional on macOS; spins sandbox + inference engine; bidirectional control signals with marketplace (e.g., marketplace can stop a worker process).
- Marketplace API manages supplier offerings, consumer interactions, backend logic; bidirectional control signals with worker.
- Marketplace website shows browse, supplier dashboard with worker install wizard + offering CRUD, plus everything else the plan + UX demand.
- Pricing page exists.
- Marketplace UI deployable to Vercel with or without the backend. With no API: landing renders from seed data. With API: data fetched live.

---

## 2. Plans (the source of truth for tasks)

Execute in this order. Each plan file uses `- [ ]` checkboxes per step; mark them `- [x]` as you go.

| # | Plan | File | Why this order |
|---|---|---|---|
| 1 | Marketplace API + data model | `docs/superpowers/plans/2026-05-10-marketplace-api-foundation.md` | Worker + frontend both depend on the API contract |
| 2 | `/v1/ws/worker` endpoint (Plan 1 follow-up) | snippet inside `docs/superpowers/plans/2026-05-10-worker-binary-macos.md` Task 6 | Needed before the worker WS code can land |
| 3 | Backend deltas for frontend | `docs/superpowers/plans/2026-05-10-frontend-marketplace.md` Task 12 | `/v1/me/role`, `/v1/bookings/{id}/messages`, messages table |
| 4 | Worker binary | `docs/superpowers/plans/2026-05-10-worker-binary-macos.md` | Independent once Plan 1 done |
| 5 | Sandbox + inference | `docs/superpowers/plans/2026-05-10-sandbox-and-inference.md` | Fills in the `SandboxBackend` trait from Plan 4 |
| 6 | Frontend marketplace | `docs/superpowers/plans/2026-05-10-frontend-marketplace.md` Tasks 1–11 | Independent once Plan 3 done |

**Parallelism:** the loop processes one task at a time, but Plans 4, 5, 6 can interleave freely once their prerequisites are done.

---

## 3. Amendments On Top Of The Plans

These are added after the plans were written. Apply them at the indicated insertion points (the loop does this when it reaches the insertion-point task).

### A. Frontend — Pricing page (insert after Plan 6 Task 5 "Browse + Offering Detail")

- Create `web/src/app/pricing/page.tsx` — three-tier display:
  - **Hire a worker** — pay-per-hour at the supplier's listed rate. Marketplace takes 12% commission.
  - **Become a supplier** — free to list, marketplace takes 12% of consumer payment, supplier keeps 88%.
  - **Marketplace value-add** (preview) — agent state migration, encrypted chat, dedicated support — labelled "coming v2".
- Link from landing page header + footer.
- Pricing copy lives in `web/src/lib/pricing.ts` so it's edited in one place.

### B. Frontend — Vercel deployability + seed data fallback (insert before Plan 6 Task 11 "Polish")

The marketing surface (`/`, `/browse`, `/pricing`, `/offerings/[id]`) must render even if `NEXT_PUBLIC_API_URL` is unreachable.

- Create `web/src/lib/seed.ts` exporting `SEED_OFFERINGS: OfferingOut[]` with 6 plausible entries (mix of M3 Pro / M3 Max / M4 Max suppliers, $0.50–$3.50/hr, varied capability tags).
- Wrap `api.get` in a `safeGet` helper for **public** endpoints: try the real call; on network error or 5xx, fall back to seed data and log a `console.warn`.
- `/browse` and `/offerings/[id]` use `safeGet`. Authed endpoints do NOT fall back — they fail closed.
- `vercel.json` (or Vercel project settings): root directory `web/`, framework auto-detect, env var `NEXT_PUBLIC_API_URL` optional. With no API set, the site builds + deploys; only public pages work; sign-in shows a "marketplace not yet live" message.
- Add a deploy step: `pnpm build` smoke test passing without API, then `vercel deploy` (preview).

### C. Plan 1 follow-up — `/v1/ws/worker` endpoint

Snippet in Plan 2 Task 6 must be merged into the API before the worker WS code can connect. Treat it as a single task immediately after Plan 1 Task 10 (CI) lands.

---

## 4. State File (`ralph-state.md`)

Maintain a single `ralph-state.md` at repo root with this exact structure. The loop reads it to decide what to do next.

```markdown
# Ralph State

STATUS: in_progress    # one of: in_progress | blocked | complete

## Current
plan: 1
task: 4
step: 3

## Completed
- plan-1/task-1 (commit abc1234)
- plan-1/task-2 (commit def5678)
- plan-1/task-3 (commit ...)

## Blocked
- (empty unless a task can't proceed; see §6 for blocking rules)

## Notes
- Brief log of decisions made during the loop (why a task was deferred, environment quirks, etc.)
```

Initial state — created automatically on first iteration if missing:
```
STATUS: in_progress
Current: plan 1, task 1, step 1
Completed: (none)
```

---

## 5. Per-Iteration Procedure (HARD RULES)

Each Ralph iteration MUST do exactly these things, in order:

1. **Read** `ralph-loop.md` (this file) + `ralph-state.md`.
2. **Resolve** the current task: locate the plan file from §2 and the task referenced in `ralph-state.md`. Read the entire task block (all its steps).
3. **Execute** every step of that single task in order:
   - Write code as the step instructs.
   - Run the test/command the step specifies.
   - Verify expected output before proceeding.
   - Mark each step `- [x]` in the plan file as it lands.
4. **Commit** at the end of the task using the message the plan specifies (Conventional Commits format).
5. **Update** `ralph-state.md`:
   - Append `plan-N/task-M (commit <sha>)` to Completed.
   - Bump Current to the next task in execution order (§2).
   - Set `STATUS: complete` if every task in every plan is done (see §7).
6. **Exit cleanly.** Do not start the next task in the same run; the loop driver invokes the next iteration.

**Hard rules:**
- One task per iteration. No batching.
- If a step fails (test red, command non-zero), do NOT skip it. Iterate on the fix within the same task. Only move on once the step's expected output matches.
- If a task references a tool the environment doesn't have (e.g., `container` CLI on a non-macOS-26 host), set `STATUS: blocked`, write the reason in `Blocked`, and exit. The loop driver decides whether to skip or fix.
- Never edit a previously-committed migration. Always add a new Alembic revision.
- Never `--no-verify` or skip pre-commit hooks. Fix the underlying issue.
- Never delete or rewrite history.
- Trust-but-verify v1 only — do NOT attempt Apple Developer signing, notarization, MDM, or anything in `docs/worker-prerequisites.md`.

---

## 6. Blocking & Skip Rules

A task is **blocked** (set `STATUS: blocked`, exit) if:
- It requires a credential not in `.env` — log which env var is missing.
- It requires a hardware capability the runner doesn't have (Apple Silicon, macOS 26 for `container`).
- A test depends on Postgres / Docker / etc. that isn't available locally — flag the missing dep.

A task is **skipped with note** (mark `- [x]` with a `~` prefix) only if it's an explicitly deferred item (e.g., real Apple Developer signing — already in `docs/worker-prerequisites.md`). Add a Notes line in `ralph-state.md` explaining why.

A task is **never** silently skipped or marked done without doing it.

---

## 7. Stop Condition

The loop terminates when `ralph-state.md` contains `STATUS: complete`.

Definition of complete (every box must be true):
- All tasks in Plans 1–6 marked `- [x]`.
- All amendments (§3) applied.
- `pnpm --filter web build` succeeds **with** `NEXT_PUBLIC_API_URL` set.
- `pnpm --filter web build` succeeds **without** `NEXT_PUBLIC_API_URL` set (seed-data fallback).
- `cd backend && uv run pytest -v` all green.
- `cd worker && cargo test` all green.
- `cd worker && cargo build --release --target aarch64-apple-darwin` succeeds.
- Smoke test: `worker/scripts/smoke-e2e.sh` passes (or set `STATUS: blocked` with reason if hardware can't run it).
- `git status` clean.
- One final commit `chore: ralph loop complete` exists.

---

## 8. How To Start The Loop

### Recommended — Claude Code self-paced loop
```
/loop ralph-loop.md
```
Claude reads this file each iteration and self-paces.

### Plugin-driven (if `ralph-loop` plugin is enabled in your environment)
```
/ralph-loop:ralph-loop ralph-loop.md
```

### Manual shell loop (no plugin required)
```bash
# Initialise state if missing
test -f ralph-state.md || cat > ralph-state.md <<'EOF'
# Ralph State

STATUS: in_progress

## Current
plan: 1
task: 1
step: 1

## Completed

## Blocked

## Notes
EOF

# Drive it
while grep -q '^STATUS: in_progress' ralph-state.md; do
    claude -p "$(cat ralph-loop.md)" --permission-mode acceptEdits
    sleep 2
done
echo "Ralph loop terminated. Final status:"
grep '^STATUS:' ralph-state.md
```

### Cancel mid-flight
```
/ralph-loop:cancel-ralph
```
Or edit `ralph-state.md` to set `STATUS: blocked`; the next iteration will exit.

---

## 9. Sanity Checks Before Starting

Run these once before kicking off the loop. If any fail, fix the host before starting — Ralph should not be installing OS-level tooling.

```bash
# Backend
which uv && uv --version            # uv >= 0.5
which docker && docker info         # daemon running, used for Postgres in dev

# Worker
which cargo && cargo --version      # rust >= 1.84
sw_vers | grep -i productversion    # macOS 26 ideally; 14/15 falls back to Lima
which container || which limactl    # at least one sandbox runtime

# Frontend
which pnpm && pnpm --version        # >= 9
node --version                      # >= 20

# Repo
git status                          # should be clean before starting
git rev-parse --abbrev-ref HEAD     # confirm correct branch
```

Optional but recommended: `worker/scripts/bootstrap-host-deps.sh` to pre-warm `mlx-lm` (Plan 5 Task 1) so the loop doesn't stall on a model download mid-iteration.

---

## 10. Reference Documents (read-only context for the loop)

- `docs/security-analysis.md` — why we're trust-but-verify in v1; what threats are NOT mitigated.
- `docs/network-and-orchestration.md` — outbound-only worker pattern, Temporal decision (NOT for v1 worker control plane).
- `docs/worker-prerequisites.md` — production hardening steps deferred to v2 (DO NOT attempt during this loop).
- `docs/inference-runbook.md` — model picking, host bootstrap, debugging mlx-lm.
- `docs/sandbox-runbook.md` — `container` / Lima troubleshooting.

---

## 11. First-Run Bootstrap Checklist (the loop does this on iteration 1)

If `ralph-state.md` doesn't exist yet:

1. Create `ralph-state.md` with `STATUS: in_progress`, current = plan 1 / task 1 / step 1, empty Completed/Blocked/Notes.
2. Verify §9 sanity checks; if anything fails, write to `Blocked` and exit.
3. Make an initial commit: `chore: bootstrap ralph loop with plans + state file` containing `ralph-loop.md`, `ralph-state.md`, and the four plan files (if not already committed).
4. Exit. Iteration 2 starts the real work at Plan 1 Task 1.
