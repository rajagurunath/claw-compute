# Changelog

## Unreleased — v0.1.0 (Trust-but-verify MVP, code-complete 2026-05-10)

The first end-to-end implementation of the Claw marketplace, built incrementally
across 4 plans (43+ ralph-loop iterations). Code-complete and tested; operational
deploy (Vercel + backend hosting + supplier registration) is the user's next
step.

### Added — Marketplace API (`backend/`)
- FastAPI app with async SQLAlchemy 2.x + asyncpg + Alembic.
- Magic-link auth (passwordless) with HS256 JWTs.
- Domain models + endpoints: users, suppliers, offerings (CRUD + browse with
  capability-tag filter), workers (provisioning-token → JWT, heartbeats with
  time-series rows), bookings (4-state machine), messages (consumer + worker-
  internal endpoints).
- `/v1/me/role` for role-aware UIs.
- `/v1/ws/worker` WebSocket endpoint with 20s ping keepalive.
- In-memory `realtime` pub/sub (Redis-swap-in for v1.5) routes booking events
  and chat messages to the right worker channel.
- 36 pytest tests, ruff-clean, GitHub Actions CI workflow (`backend-ci.yml`),
  multi-stage Dockerfile.

### Added — Worker (`worker/`)
- Rust 1.90 / edition 2024 binary, Apple-Silicon-only.
- Outbound-only architecture: REST for register / heartbeat / message-relay,
  long-lived WebSocket for booking events.
- `SandboxBackend` trait with three implementations and auto-select:
  - Apple `container` (macOS 26+)
  - Lima (macOS 14/15 fallback)
  - Noop (dev / test)
- `ModelHost` supervises `uv tool run mlx_lm.server`; idempotent
  `ensure_loaded(model_id, port)`.
- Local SQLite for crash-recovery; macOS Keychain for the worker JWT (with a
  `CLAW_WORKER_TOKEN` env override for ad-hoc-signed binaries that can't write
  there).
- `install.sh` one-liner installer; `package-tarball.sh` produces an ad-hoc
  signed `aarch64-apple-darwin` tarball.
- 18 cargo tests (lib + booking-lifecycle + register-flow + gated container
  smoke + 1 doctest), CI workflow (`worker-ci.yml`) on macos-14 runners.
- End-to-end smoke against a live local API verified: backend selected = lima,
  mlx-lm spawned, WS connected, heartbeat rows landed in Postgres.

### Added — Frontend (`web/`)
- Next.js 16 App Router + Tailwind 4 + shadcn/ui (16 base components, Radix-
  backed).
- Marketing landing with animated gradient hero, 6 feature cards (per-card
  colored icon backgrounds), copy-on-click supplier CTA.
- Browse + offering detail (force-dynamic SSR; capability-tag filter).
- Pricing page (3 tiers + 4-FAQ; `lib/pricing.ts` is the single copy source).
- Auth flow: magic-link request, verify, logout, httpOnly session cookie.
- Authed dashboard with role-aware sticky sidebar.
- Become-a-supplier (zod-validated form), worker management with 2-stage
  install wizard (copy-on-click snippets), offering CRUD with colored status
  badges and a Danger Zone.
- Consumer bookings list + chat detail with optimistic-insert/rollback,
  ⌘+Enter to send, auto-scroll, Bot/User avatar bubbles.
- 404 + error boundary with friendly copy + retry.
- **Vercel-deployable with or without backend**: `safeGet` wrapper falls back
  to 6 seed offerings on network errors / 5xx; `/auth/login` shows a "public
  preview" banner when `NEXT_PUBLIC_API_URL` is unset.
- CI workflow (`web-ci.yml`) builds twice — with and without API URL — to
  guard the seed fallback.

### Added — Sandbox + Inference (`agent-image/`, `worker/src/sandbox/`, scripts/)
- `agent-image/`: Python 3.12 + FastAPI runtime that reads `/etc/claw.json`
  and proxies chat to mlx-lm at `host.containers.internal:9000`.
- 2-stage uv-based Dockerfile; idempotent `build.sh` that picks Apple
  `container` if available, else docker.
- Host bootstrap: `worker/scripts/bootstrap-host-deps.sh` installs uv +
  mlx-lm; falls back to Lima on macOS 14/15.
- E2E smoke runner: `worker/scripts/smoke-e2e.sh` covers API health → image
  build → mlx-lm boot → sandbox run → /health → /v1/chat/completions →
  cleanup via trap.

### Added — Documentation
- `README.md` — orientation + quick-start.
- `docs/architecture.md` — system diagram + component boundaries + threat
  model summary.
- `docs/security-analysis.md` — Darkbloom investigation, alternatives matrix,
  v1 trust-but-verify decision with explicit DO / DO-NOT-CLAIM lists.
- `docs/network-and-orchestration.md` — outbound-only worker pattern + the
  Temporal-vs-bespoke control-plane decision (skip Temporal for v1; payload-
  codec encryption verified for v2 path).
- `docs/inference-runbook.md` — MLX rationale, model catalog keyed to
  `worker/src/inference/models.rs`, troubleshooting.
- `docs/sandbox-runbook.md` — `container` / Lima troubleshooting, e2e
  pointer, manual diagnosis flow.
- `docs/worker-prerequisites.md` — every human-only step deferred to v2
  (Apple Developer enrollment, MDM, ACME, notarization, Hardened Runtime
  switchover, auto-update channel).
- `docs/vercel-deploy.md` — Vercel project setup with rootDirectory=web/.
- `docs/superpowers/plans/2026-05-10-*.md` — the four implementation plans
  the build follows; every step checked.

### Notable design decisions
- **Trust-but-verify v1** — defer Apple Hardened Runtime + Secure Enclave
  attestation + E2E encryption to v2. Document why explicitly.
- **Outbound-only worker** — no inbound port on supplier hardware; same
  reachability story as Darkbloom, GitHub Actions runners, Cloudflare
  Tunnels.
- **Apple `container` primary, Lima fallback** — picked over Daytona (AGPL),
  E2B (Linux-side only), Ollama (slower than mlx-lm direct). MLX 20-40%
  faster than llama.cpp on Apple Silicon, 3× faster on MoE.
- **Custom WS over Temporal for v1** — booking lifecycle is volatile in
  month one; ~200 LOC of bespoke pub/sub absorbs that better than Temporal
  workflow versioning. Use the Temporal credits on the scoring/ranking
  subsystem instead (Plan 5 candidate).
- **Frontend Vercel-deployable without backend** — public-preview mode
  renders from seed data so marketing goes live before the platform.

### What is *not* in this release
- No production deploys. Frontend not on Vercel; backend not hosted; no
  supplier has installed and registered the worker tarball publicly.
- Stripe / payments — deferred to v1.5.
- OpenClaw / Hermes integration — deferred to v2 (agent image variants).
- Agent state migration to S3 — deferred to v2.
- Hardened Runtime + Secure Enclave attestation — deferred to v2 (see
  `docs/worker-prerequisites.md`).
- Real consumer→sandbox chat round-trip — the worker logs `MessageUser`
  events; forwarding to the sandbox + posting assistant replies via the
  internal endpoint is wired but not yet exercised end-to-end.
