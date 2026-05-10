# Startup Guide

Quick reference for running the marketplace locally with the new Makefile.

## TL;DR — three terminals

```bash
# Terminal 1: API (and DB, and Alembic migrations)
make api
# → keep this open; the magic-link sign-in tokens print here

# Terminal 2: Frontend
make web
# → http://localhost:3000

# Terminal 3 (optional): Worker
make worker-token EMAIL=you@example.com   # mints CLAW_WORKER_TOKEN
export CLAW_API_URL=http://localhost:8000
export CLAW_WORKER_TOKEN=<paste from above>
make worker-run
```

That's it. The DB is started automatically by `make api`.

## Where do I get the magic-link token?

The auth flow is passwordless email links. In dev, links aren't emailed —
they're written to the API's stdout. So:

1. **Terminal 1 (`make api`)**: leave this open.
2. **Browser**: visit http://localhost:3000/auth/login → enter your email →
   submit.
3. **Terminal 1 prints**:
   ```
   MAGIC LINK for you@example.com: token=lP9rT2…
   ```
4. **Browser**: paste that token into
   `http://localhost:3000/auth/verify?token=<paste>` → you're signed in,
   24-hour cookie session.

### One-liner if you don't want to copy/paste

If the API is running in **background mode** (`make up`), tokens go to
`.logs/api.log` and the Makefile can fish them out for you:

```bash
make magic EMAIL=you@example.com
# prints:
#   🔑 Sign in:
#   http://localhost:3000/auth/verify?token=lP9rT2…
```

(`make magic` doesn't work when API is foregrounded with `make api` because
there's no log file to grep — just copy the token from the terminal.)

### Skip auth entirely (dev only)

```bash
make dev-bypass        # mints a 24h JWT, writes CLAW_DEV_JWT to web/.env.local
                       # restart the web server for it to take effect
make down && make up   # or Ctrl-C `make web` and rerun

# Now any /dashboard URL works without sign-in.
make dev-bypass-off    # restore real auth
```

## The other operations

### Database
```bash
make db-up        # start Postgres docker container
make db-down      # stop (volume preserved)
make db-shell     # psql into claw_dev
make db-reset     # drop volume + recreate + re-migrate (loses all data)
make migrate      # alembic upgrade head
```

### Tests
```bash
make test           # backend pytest + worker cargo test
make test-backend   # 36 pytest tests
make test-worker    # 20 cargo tests
make test-web       # next build
```

### Demo data
```bash
make seed-demo
# Creates a supplier with 3 offerings, a registered worker, an active
# booking, and a 4-message chat thread. Prints magic-link URLs for both
# the supplier and the consumer.
```

### Worker
```bash
make worker-build   # cargo build --release --target aarch64-apple-darwin
make worker-test    # 20 tests
make worker-token EMAIL=you@example.com
                    # full register flow → prints CLAW_WORKER_TOKEN to export
make worker-run     # runs the worker (needs CLAW_WORKER_TOKEN exported)
```

### Background mode (api+web in one shot, less log clarity)
```bash
make up         # starts api + web in background, logs go to .logs/{api,web}.log
make logs       # tail -F both logs
make status     # what's listening on which port
make down       # stop background api + web (db left running)
```

### Cleanup
```bash
make down       # stop bg services
make db-down    # stop Postgres
make clean      # nuclear: stop all + drop DB volume + remove build artefacts
```

## File layout produced at runtime

```
.pids/         # background-mode PIDs (api.pid, web.pid)
.logs/         # background-mode logs (api.log, web.log)
backend/.env   # uvicorn config (DATABASE_URL, JWT_SECRET, MAGIC_LINK_DELIVERY)
web/.env.local # Next.js config (NEXT_PUBLIC_API_URL, optional CLAW_DEV_*)
```

`.pids/` and `.logs/` are gitignored.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `make api` hangs at "Compiling…" | `uv sync` first run | wait — it's downloading deps once |
| `make up` says "api already up (pid …)" but the API is dead | stale PID file | `rm .pids/api.pid && make up` |
| Sign-in 401 with valid-looking token | token already consumed (single-use) or expired (15 min TTL) | request a new magic-link |
| `make web` says EADDRINUSE | another Next.js still listening on :3000 | `lsof -i :3000 -sTCP:LISTEN` then `kill <pid>` |
| Dashboard "Something broke" | API down or token issue | check Terminal 1 for stack traces; `make status` |
| ngrok / Vercel weirdness | not using them anymore — pure localhost setup | ignore prior URLs; use `localhost:3000` |
