# Ralph State

STATUS: in_progress

## Current
plan: deploy
task: backend-deploy
step: 1

## Completed
- bootstrap (commit 1e0756b)
- plan-1 — full backend (last: 2747674)
- plan-1/followup-ws (commit 00d209b)
- plan-4/task-12 (commit b89b1d0) — backend deltas
- plan-2 — full Rust worker (last: 577b348)
- plan-6 — full frontend (last: 6b0b3cb), incl. amendments §3.A pricing + §3.B Vercel/seed-fallback
- plan-5 — sandbox + inference (last: 574afcd)
- post-plan polish: README + worker/web CI (36b3579)
- worker --worker-token override (a945f03)
- architecture diagram + CHANGELOG (361366d)
- consumer→sandbox→assistant chat relay impl + tests (0fbc122)
- **deploy/frontend: production deploy to Vercel ✓** (this iteration)

## Live deploys (this iteration!)
- **Frontend on Vercel**:
  - https://web-virid-kappa-99.vercel.app (alias)
  - https://web-i8kgix5j7-gurunaths-projects-60ac67e1.vercel.app (deployment)
  - Verified: /, /browse, /pricing, /offerings/seed-*, /auth/login all return 200
  - Renders seed offerings (Mac Studio M3 Max, Mac mini M4, MacBook Pro M3 Pro all visible) → safeGet fallback IS firing in production since NEXT_PUBLIC_API_URL is unset on the Vercel project
  - Auth login shows "public preview" banner + disabled form, as designed
- Inspector: https://vercel.com/gurunaths-projects-60ac67e1/web/EHoJUCqbRozd6m9QgmuwEcpFJFU5
- Vercel scope: gurunaths-projects-60ac67e1 (user's account, authed via prior `vercel login`)

## What just got verified end-to-end (in production!)
1. Tailwind 4 + shadcn/ui assets serve correctly
2. RSC dynamic routes (/browse, /offerings/[id]) render on demand
3. Seed-data fallback works: API fetch fails → `safeGet` returns SEED_OFFERINGS → grid populates
4. Static prerender works for / and /pricing
5. CSS animations (gradient mesh, hover lifts, breathing dot) render

## Still blocked (operational, user-driven)
- **Backend not hosted publicly.** Frontend currently runs in seed-only mode; sign-in is disabled. To wire it up: deploy `backend/Dockerfile` to a host (Fly / Render / Railway / etc.), point a subdomain at it, then `vercel env add NEXT_PUBLIC_API_URL production` and redeploy.
- **No supplier registered publicly.** Worker tarball at `dist/claw-worker-0.1.0-aarch64-apple-darwin.tar.gz` ready to install on a real Mac; needs the public backend URL to register against.
- **Agent image not built locally** (Docker pulls hang in this loop's harness; works fine in a normal terminal).

## Updated §7 stop-condition status

| Check | Status |
|---|---|
| All plan tasks `- [x]` | ✅ |
| Amendments §3.A + §3.B applied | ✅ |
| `pnpm build` with API | ✅ |
| `pnpm build` without API | ✅ |
| `pytest -v` green | ✅ 36 pass |
| `cargo test` green | ✅ 20 pass (with new chat-relay tests) |
| `cargo build --release --target aarch64-apple-darwin` | ✅ |
| `smoke-e2e.sh` green | ⚠️ partial (api↔worker plane verified live; sandbox plane needs agent-image) |
| `git status` clean | (after this commit) |
| **Frontend deployed** | ✅ NEW — public preview on Vercel |
| **Backend deployed** | ❌ — user-driven |
| **Worker registered live** | ❌ — needs public backend |
| Final `chore: ralph loop complete` | ❌ pending true completion |

## What the user needs to do now (3 steps)

```bash
# 1. Deploy backend (any host that runs Docker)
cd backend
docker build -t claw-api .
fly launch  # or: render new service, etc.
# Get back something like: https://claw-api.fly.dev

# 2. Wire frontend to live API + redeploy
cd ../web
echo "NEXT_PUBLIC_API_URL=https://claw-api.fly.dev" | vercel env add NEXT_PUBLIC_API_URL production
pnpm dlx vercel deploy --prod --scope gurunaths-projects-60ac67e1

# 3. Install worker on a Mac, become a supplier via the live UI:
curl -fsSL https://web-virid-kappa-99.vercel.app/install.sh | bash  # (after step 2 makes this redirect to api)
# OR locally:
./dist/claw-worker-0.1.0-aarch64-apple-darwin.tar.gz
# (but install.sh expects the API URL to host /releases/... so backend needs to serve it)
```

Once backend is live + worker registered, run `./worker/scripts/smoke-e2e.sh` for the full sandbox round-trip.

To stop the loop now: `/ralph-loop:cancel-ralph`. Otherwise I'll continue making polish / additional improvements.
