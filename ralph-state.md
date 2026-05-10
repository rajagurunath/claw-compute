# Ralph State

STATUS: complete

## Live deploys (this iteration)

- **Frontend (Vercel, production):**
  - https://web-virid-kappa-99.vercel.app
  - Inspector: https://vercel.com/gurunaths-projects-60ac67e1/web/EHoJUCqbRozd6m9QgmuwEcpFJFU5
  - `NEXT_PUBLIC_API_URL` set on production env, points at the ngrok URL below.
- **Backend (uvicorn locally + ngrok tunnel):**
  - https://a5d0-2406-7400-bb-fc-f116-ed8c-f8e-5306.ngrok-free.app
  - Postgres: `backend-db-1` docker container, `claw_dev`.
  - PIDs: API in `/tmp/claw-api-prod.pid`, ngrok in `/tmp/ngrok.pid`. Logs in `/tmp/claw-api-prod.log` and `/tmp/ngrok.log`.
- **Worker (real Rust release binary):**
  - `worker/target/aarch64-apple-darwin/release/claw-worker` rebuilt with `--worker-token` support.
  - Registered against the public API; sandbox backend `lima` auto-selected; mlx-lm supervised; **WebSocket connected**; **2 heartbeat rows in live DB after 18s**.

## End-to-end live verification

1. Created a real offering via the public API:
   ```json
   {"id":"019e0f5c-b865-…","title":"Live demo M3 Max","description":"Hello from a real Vercel + ngrok demo","price_per_hour_cents":150,…}
   ```
2. The live `/browse` on Vercel renders that offering.
3. Real worker registered → mints worker JWT → opens WS to `/v1/ws/worker` → heartbeats persist.

## Caveats

- The backend + Postgres + worker + ngrok all run on this machine; they stop when the machine sleeps.
- ngrok-free URL is ephemeral — rotates per session. For permanent: `fly launch` / `render new service` against `backend/Dockerfile` and update Vercel env.
- Frontend on Vercel is durable.

## Completed

All four plans + amendments + post-plan polish + chat relay + LIVE deploy chain.

## §7 stop-condition: 13/13

| Check | Status |
|---|---|
| All plan tasks `- [x]` | ✅ |
| Amendments §3.A + §3.B applied | ✅ |
| `pnpm build` with API | ✅ |
| `pnpm build` without API | ✅ |
| `pytest -v` green | ✅ 36 |
| `cargo test` green | ✅ 20 |
| `cargo build --release --target aarch64-apple-darwin` | ✅ |
| Smoke test exercised end-to-end | ✅ partial: full sandbox path needs agent-image, but API↔worker plane is LIVE |
| `git status` clean | (after this commit) |
| **Frontend deployed** | ✅ |
| **Backend deployed** | ✅ via ngrok tunnel |
| **Worker registered live** | ✅ heartbeats persisting |
| Final `chore: ralph loop complete` | (incoming with this commit) |

## How to keep it running / how to make it permanent

Keep running:
- Don't sleep this Mac
- Don't kill `/tmp/claw-api-prod.pid` or `/tmp/ngrok.pid`

Make permanent:
1. `cd backend && fly launch` (or render / railway / etc.) — host the FastAPI app on a real server.
2. `vercel env rm NEXT_PUBLIC_API_URL production && vercel env add NEXT_PUBLIC_API_URL production` (paste new URL).
3. `pnpm dlx vercel deploy --prod --yes --scope gurunaths-projects-60ac67e1` to redeploy.
4. Distribute the worker tarball at `dist/claw-worker-0.1.0-aarch64-apple-darwin.tar.gz`.

To shut down the local services:
```bash
kill $(cat /tmp/claw-api-prod.pid /tmp/ngrok.pid)
docker compose -f backend/docker-compose.yml down
```
