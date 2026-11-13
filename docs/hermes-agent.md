# Claw Hermes — persistent agents, paid on Arc, backed by GLM

Hermes is the third Claw workload: a **persistent agent** a consumer rents by
the hour. Unlike the ephemeral Sandbox/OpenClaw workloads, a Hermes agent
**remembers across bookings** — you can hire a Mac on Monday, come back Friday,
and the agent still knows who you are and what you were doing.

This document describes the working end-to-end flow: **sign in → request the
agent → pay in USDC on Circle Arc → the supplier's machine boots the agent →
chat with it (backed by GLM-5.2) → it remembers you → end the session and get
charged only for what you used.**

Everything here is verified live (Arc testnet + a real worker + real GLM).

## The flow

```
consumer signs in (magic link)
      │
      ▼
requests a Hermes offering, clicks "Start agent"
      │
      ▼  backend: settle_on_activate
pay on Arc:  deposit (if escrow short)  →  openBooking (lock 1h of USDC)
      │                                        │  402 if the client can't pay
      ▼                                        ▼
booking → active in Postgres            WS booking_activated{workload:hermes,
      │                                        hermes_agent_id, model_id}
      │                                        │
      │                                        ▼  worker (docker backend)
      │                                boots agent container +
      │                                mounts named volume claw-hermes-<id>
      ▼                                        │
consumer chats: POST /bookings/{id}/messages   │
      │  → WS message_user → worker relays ─────┤
      │  → agent /v1/chat/completions ──────────┤
      │      · injects Hermes memory + history  │  GLM-5.2 (io.net)
      │      · calls GLM, saves the turn        │
      │  ← assistant reply posted back ─────────┘
      ▼
ends session → settleBooking on Arc:
   charge actual usage · pay supplier 85% · treasury 15% · release the rest
```

## What the client gets in return

1. **A useful agent.** Chat is backed by **GLM-5.2** (served via io.net's
   OpenAI-compatible endpoint). Real answers, not a stub.
2. **Continuity — the Hermes point.** The agent persists its conversation to a
   Docker **named volume** keyed by a stable `hermes_agent_id =
   sha256(consumer_id:offering_id)[:16]`. `docker rm` drops the container; the
   volume survives and is remounted on the next booking, so memory carries over.

### Verified transcript (Arc testnet, GLM-5.2)

Booking 1 — teach it:

```
🧑 Remember this for later: my name is Guru and my favorite language is Rust.
🤖 Got it, Guru! I'll remember you're a Rust developer. How can I help you today?
```

End booking 1 (settle on Arc), then a **brand-new booking**, same identity:

```
🧑 Without me telling you again — what's my name and favorite language, and what am I building?
🤖 You're Guru, your favorite language is Rust, and you're building a USDC
   payments app (using Circle Arc, which we discussed earlier).
```

The agent's volume (`claw-hermes-26a154e34bdf88b3`) held **2 bookings, 8 turns**
across those sessions — cross-booking persistence, on disk.

## Arc payment legs (per booking)

| Leg | When | On-chain |
|---|---|---|
| `deposit` | activation, if free escrow < lock | consumer funds escrow ("client pays") |
| `openBooking` | activation | lock rate × 1h (`CHAIN_MAX_BOOKING_HOURS`) |
| `settleBooking` | end session | charge actual usage; 85% supplier / 15% treasury; release lock |

All three are real Circle → Arc transactions, public at `GET /v1/ledger` /
`/ledger`, tagged `workload = hermes`. On testnet a single custodial Circle
wallet plays settler + treasury + consumer escrow (see
[`onchain-settlement.md`](./onchain-settlement.md)).

## Components

| Piece | Role |
|---|---|
| `backend/claw_api` | booking lifecycle; `settle_on_activate` (deposit+lock) / `settle_on_close` (settle); `_agent_config` puts `{workload, model_id, hermes_agent_id}` on the activation event |
| `worker` (Rust) | receives `booking_activated`, boots the agent via the **docker** backend, mounts the Hermes named volume, writes `/etc/claw.json` (incl. inference endpoint) |
| `agent-image` (Python) | FastAPI runtime: `/v1/chat/completions` (calls the configured LLM, injects memory + history, saves each turn), `/v1/hermes/memory`, `/health` |
| GLM-5.2 via io.net | the actual model behind chat (any OpenAI-compatible endpoint works) |

## Configuration

### Inference (the supplier's model), set on the **worker**

The supplier points the agent at any OpenAI-compatible endpoint. The API key
stays on the supplier's host — written into the container, never logged, never
sent to the consumer.

```bash
export CLAW_INFERENCE_BASE_URL="$IO_API_BASE"   # e.g. https://…io.solutions/v1
export CLAW_INFERENCE_API_KEY="$IO_API_KEY"     # bearer token, host-only
export CLAW_MODEL="zai-org/GLM-5.2"
export CLAW_SANDBOX_BACKEND=docker
export CLAW_SKIP_MODEL_HOST=1                    # don't start local mlx-lm
export CLAW_API_URL=http://localhost:8001
export CLAW_WORKER_TOKEN=<from worker register>
./worker/target/debug/claw-worker run
```

GLM-5.2 is a **reasoning model**: the answer lands in `choices[0].message.content`
after it thinks in `reasoning_content`, so the agent sends a generous
`max_tokens` and falls back to the reasoning text if content is ever empty —
the consumer never gets a blank reply.

### Auth (dev)

No email provider is wired in dev (`MAGIC_LINK_DELIVERY=console`). To make
sign-in work without a mailer, `POST /v1/auth/magic-link` returns a
`dev_login_token` and the login page shows a one-click **Sign in now** link
(`/auth/verify?token=…`). In production, swap `deliver_magic_link` for a real
mailer and the token is not returned.

## Run it end to end (local + Arc testnet)

```bash
# 1. backend against Arc (backend/.env: CHAIN_ENABLED=true, CHAIN_SIGNER_MODE=circle, …)
cd backend && uv run uvicorn claw_api.main:app --port 8001

# 2. worker with GLM inference (env above), docker backend

# 3. web
cd web && echo "NEXT_PUBLIC_API_URL=http://localhost:8001" > .env.local && pnpm dev

# 4. in the UI: sign in → browse a Hermes offering → Start agent (pays on Arc)
#    → chat on the booking page → End session (settles on Arc)
```

## Limits / deferred

- **Custodial wallet** on testnet (one funded Circle wallet). Per-user
  non-custodial wallets are a later extension; the code already prefers
  `user.wallet_address` when set.
- **Memory** is a capped JSON of recent turns + notes on the volume — enough for
  continuity, not a vector store. Semantic recall / summarization is future work.
- The inference API key lives in the container config (operator's key). A real
  deployment would give each supplier their own inference + key management.
