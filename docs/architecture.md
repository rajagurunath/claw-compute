# Claw Marketplace — Architecture

## High-level system view

```
                 ┌────────────────────────────────────────┐
                 │            Consumer's browser          │
                 │  (Next.js 16, Tailwind, shadcn/ui)     │
                 └───────────────┬────────────────────────┘
                                 │ HTTPS  (cookie session)
                                 ▼
                 ┌────────────────────────────────────────┐
                 │       Marketplace API (FastAPI)        │
                 │  • magic-link auth + JWT               │
                 │  • supplier / offering / booking CRUD  │
                 │  • realtime in-mem pub/sub             │
                 │                                        │
                 │  ┌────────────────────────────────┐    │
                 │  │  Postgres                      │    │
                 │  │  users / suppliers / offerings │    │
                 │  │  workers / heartbeats / bookings│   │
                 │  │  messages                      │    │
                 │  └────────────────────────────────┘    │
                 └────────────┬───────────────┬───────────┘
                              │               │
        ws://api/v1/ws/worker │               │ HTTPS REST (heartbeat,
        (server pushes events)│               │  booking transitions,
                              ▼               │  message relay)
                 ┌────────────────────────────┴───────────┐
                 │      Worker (Rust, macOS / ARM64)      │
                 │    (behind NAT — outbound only)         │
                 │  • register / heartbeat / WS handler   │
                 │  • SandboxBackend trait:               │
                 │      Container | Lima | Noop           │
                 │  • ModelHost: spawns mlx_lm.server     │
                 │  • Local SQLite for crash-recovery     │
                 └────────────┬───────────────┬───────────┘
                              │               │
              spawns          │               │  HTTP localhost
              container ─────►│               │  :9000  (mlx-lm)
                              ▼               │
                 ┌────────────────────────┐   │
                 │   Sandbox (Linux VM)   │   │
                 │   claw/agent-base      │   │
                 │   FastAPI runtime      │   │
                 │                        │   │
                 │   reads /etc/claw.json │   │
                 │   serves /v1/chat/...  │   │
                 └────────┬───────────────┘   │
                          │                   │
                          │ host.containers   │
                          │ .internal:9000    │
                          ▼                   ▼
                 ┌────────────────────────────────────────┐
                 │   mlx-lm.server  (host process)        │
                 │   model: Qwen3.5-7B-Instruct-4bit      │
                 │   (or Gemma 3 12B / Qwen 30B MoE)      │
                 └────────────────────────────────────────┘
                          │
                          ▼
                 Apple Silicon GPU (Metal / MLX)
```

## Component boundaries

| Layer | Lives where | Talks to |
|---|---|---|
| Frontend | Vercel CDN + serverless functions | Marketplace API only |
| Marketplace API | Single FastAPI app + Postgres | Frontend (HTTPS) + Workers (WS + HTTPS) |
| Worker | Supplier's Mac | Marketplace API (outbound) + Sandbox (HTTP localhost) + mlx-lm (HTTP localhost) |
| Sandbox | Linux microVM on supplier's Mac | mlx-lm (`host.containers.internal`) |
| mlx-lm | Native macOS process on supplier's Mac | Apple Silicon GPU directly |

## Why outbound-only

The worker initiates all connections. The marketplace never opens a socket toward the supplier's machine. This means:
- Suppliers don't configure NAT, firewall, or DDNS.
- Residential / corporate / hotel WiFi all work because port 443 outbound is universal.
- No inbound exposure to attack from the public internet.

Same pattern as GitHub Actions self-hosted runners, Cloudflare Tunnels, and Darkbloom. See [`network-and-orchestration.md`](./network-and-orchestration.md) §1 for the full message-flow trace.

## State boundaries

- **Marketplace Postgres** — authoritative state (users, suppliers, offerings, workers, bookings, messages, heartbeats).
- **Worker SQLite** (`~/Library/Application Support/claw-worker/state.db`) — local cache + crash-recovery for active bookings and the sandbox ids that map to them.
- **macOS Keychain** — long-lived worker JWT (with `--worker-token` env override for ad-hoc-signed binaries that can't reach Keychain).
- **`/etc/claw.json` inside the sandbox** — booking-scoped config (booking_id, model_id, agent_config blob), bind-mounted from the host at sandbox-start time.

## Data plane vs control plane

| Plane | Path | Latency | Volume |
|---|---|---|---|
| Control (booking transitions, heartbeats) | Marketplace ↔ Worker WS + REST | tens of ms | low (15s heartbeats, sparse events) |
| Data (chat messages, agent state) | Consumer → Marketplace → Worker → Sandbox → mlx-lm → … back | streaming, sub-second | bursty per booking |

Plan 5+ may move the **control** plane to Temporal (durable, schedulable, debuggable). The data plane stays direct so streaming responses remain fast and so v2 can layer Noise/X25519 on top without coordinator visibility. See [`network-and-orchestration.md`](./network-and-orchestration.md) §2.

## Threat model summary (v1 ships under "trust-but-verify")

| Adversary | Mitigation in v1 | Mitigation deferred to v2 |
|---|---|---|
| Network MITM | TLS 1.3 throughout | — |
| Marketplace operator reads consumer payloads | Operationally trusted | E2E encryption (Noise / X25519) |
| Supplier reads agent memory | Open-source binary, reputation, audit logs | Hardened Runtime + Secure Enclave attestation (Darkbloom-style) |
| Stolen worker token | Single-use provisioning + revocable JWT | Hardware-bound P-256 attestation key |
| Ad-hoc-signed binary tampering | Code-signing helper + checksum manifest | Apple Developer ID + notarization + ACME-issued device certs |

Full analysis: [`security-analysis.md`](./security-analysis.md).

## Code ↔ doc cross-reference

| Concept | Code | Doc |
|---|---|---|
| Outbound WS | `worker/src/api/ws.rs` + `backend/src/claw_api/api/v1/workers.py` `worker_ws` | network-and-orchestration §1.4 |
| In-memory pub/sub | `backend/src/claw_api/realtime.py` | network-and-orchestration §1.7 |
| Sandbox abstraction | `worker/src/sandbox/{mod,container,lima,noop}.rs` | inference-runbook |
| Model catalog | `worker/src/inference/models.rs::CATALOG` | inference-runbook |
| Booking state machine | `backend/src/claw_api/models/bookings.py::VALID_TRANSITIONS` | (none — code-as-doc) |
| Seed-data fallback | `web/src/lib/{safe-api,seed}.ts` | vercel-deploy |
| Production hardening checklist | (n/a — not yet implemented) | worker-prerequisites |
