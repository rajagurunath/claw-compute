# Network Reachability & Orchestration

**Date:** 2026-05-10
**Status:** v1 architecture decision; Temporal adoption flagged for v1.5+.

This document covers two related concerns:
1. **Reachability** — how the marketplace talks to a worker process that lives behind NAT on a supplier's Mac.
2. **Orchestration** — when and why we'd adopt Temporal as the control plane, and how its built-in E2E encryption fits the v2 security goals.

---

## Part 1 — Network Reachability

### 1.1 The constraint

Workers run on supplier laptops, Mac Studios, and Mac Minis sitting on residential or office networks. They have:
- No public IPv4 address (CGNAT or RFC1918 behind a router)
- No port forwarding (suppliers won't configure UPnP / DDNS)
- Possibly a corporate proxy or captive portal in the way
- Possibly an aggressive firewall that blocks all inbound

The marketplace cannot *initiate* a TCP connection to a worker. Period.

### 1.2 The pattern: outbound-only, long-lived

The worker reaches *out* to the marketplace; the connection stays open; the marketplace pushes work over the existing connection.

```
Worker (supplier Mac, behind NAT)              Marketplace (cloud, public)
            │                                            │
   1. POST /v1/workers/register  (HTTPS, port 443)  ───►│
            │ ◄───── 200 + worker_token (JWT) ───────── │
            │                                            │
   2. WSS upgrade /v1/ws/worker  (port 443)         ───►│
            │      Bearer worker_token                   │
            │ ◄══════ persistent WebSocket ═══════════ │
            │                                            │
   3. Marketplace pushes events as JSON frames           │
            │ ◄───── {"type":"booking_activated", ...} ─│
            │ ◄───── {"type":"message_user", ...} ──── │
            │ ◄───── {"type":"ping"} every 20s ────── │
            │                                            │
   4. Worker uses normal REST for replies                │
            │ POST /v1/bookings/{id}/messages/internal ►│
            │ POST /v1/workers/heartbeat ─────────────►│
```

**Why this works:** every NAT, firewall, and proxy on the planet allows outbound TCP/443 — that's how the entire web functions. Once the connection is established, the NAT keeps a flow record open and routes return traffic. No supplier configuration required.

### 1.3 Same pattern, different products

| Product | Mechanism |
|---|---|
| GitHub Actions self-hosted runners | Long-poll over HTTPS |
| Cloudflare Tunnels (`cloudflared`) | Outbound QUIC/HTTP3 to Cloudflare edge, reverse-proxied |
| Tailscale | Outbound to control plane (control); peer-to-peer NAT punching (data) |
| Discord bots, Slack bots | Outbound WebSocket |
| Temporal workers | Outbound long-poll on a task queue (gRPC) |
| **Darkbloom providers** | **Outbound WebSocket to coordinator** (verified — see §1.5) |
| **Claw workers (this marketplace)** | **Outbound WebSocket to marketplace** (Plan 2 Task 6) |

### 1.4 End-to-end message flow for the data plane

How a consumer's chat message reaches the agent in a sandbox:

```
Consumer (browser)
    │  HTTPS POST /v1/bookings/{id}/messages
    ▼
Marketplace (cloud)
    │  Persist message row (Postgres)
    │  Publish to channel "worker:{worker_id}" (in-memory pub/sub v1; Redis v1.5)
    ▼
[ existing outbound WS opened by worker earlier ]
    │  {"type":"message_user","booking_id":"...","content":"..."}
    ▼
Worker (Mac, behind NAT)
    │  HTTP POST localhost:18080/v1/chat/completions  (forwarded to sandbox VM)
    ▼
Sandbox VM (Apple `container` on the worker's Mac)
    │  Agent runtime (FastAPI inside VM)
    │  HTTP GET host.containers.internal:9000/v1/chat/completions
    ▼
mlx-lm server (process on the worker's Mac)
    │  Tokens stream back ▲
    ▼
Sandbox returns ─► Worker
    │
    │  HTTPS POST /v1/bookings/{id}/messages/internal  (assistant reply, REST)
    ▼
Marketplace persists assistant message
    │  If consumer is polling: serve on next GET
    │  If consumer has SSE/WS to marketplace: push immediately
    ▼
Consumer renders the assistant message
```

**Critical property:** every leg either originates in the supplier's network (outbound) or stays in the supplier's loopback (`localhost` and `host.containers.internal`). No inbound port on the supplier's machine, ever.

### 1.5 How Darkbloom solves the same problem (verified)

From the public README of `Layr-Labs/d-inference`:
> "Providers connect outbound over WebSocket -- no port forwarding needed."

Architecture:
```
Consumer → Coordinator (Go, Confidential VM, public)
              │   ▲
              │   │ persistent outbound WSS
              ▼   │
          Provider (Rust, hardened process, behind NAT)
              │
              ▼
          vllm-mlx → Apple Silicon GPU
```

Verified in source:
- `provider/Cargo.toml` pulls `tokio-tungstenite = "0.26"` (WebSocket client).
- `provider/build.rs` bakes the coordinator URL via env var `DARKBLOOM_COORDINATOR_URL`, derives both `https://` (REST) and `wss://` (WebSocket) forms.
- `provider/src/coordinator.rs` (60 KB) holds the WS reconnect logic.
- The coordinator encrypts each request with the provider's X25519 public key *before* sending it over the WS — so even if the WS itself were compromised, payloads remain opaque.

Our v1 omits the X25519 layer (Trust-but-verify) but keeps the same network shape, so adding it later doesn't change reachability.

### 1.6 Edge cases & mitigations

| Edge case | Mitigation in Plan 2 |
|---|---|
| Idle WS dropped by proxy after 30–120 s | Server sends `{"type":"ping"}` every 20 s; worker responds with `Pong` frame |
| TCP RST mid-flight (Wi-Fi flap, sleep/wake) | Worker reconnects with exponential backoff (1 s → 2 s → 4 s → 60 s cap) |
| Worker offline during booking activation | Marketplace queues the event; `GET /v1/workers/me/pending-events` drains on reconnect (Plan 2 Task 6 follow-up) |
| Worker offline > 5 min | Marketplace marks worker `offline`, transitions active bookings to `cancelled`, refunds consumer |
| Captive portal (hotel WiFi, etc.) | Same as TCP RST — reconnect loop. Worker logs a `WARN` after 5 failed attempts so the supplier sees it |
| Marketplace restart | All WSs drop simultaneously; workers reconnect with jittered backoff to avoid thundering herd |

### 1.7 Scaling concerns (v1 → v1.5)

Holding one persistent WS per worker has a real cost on the marketplace side:

| Active workers | WS state | Approx RAM | File descriptors |
|---|---|---|---|
| 100 | tiny | 5 MB | 100 |
| 1 000 | OK | 50 MB | 1 000 |
| 10 000 | painful | 500 MB | 10 000 (raise `ulimit -n`) |
| 100 000 | needs sharding | shard across N nodes | many |

**Mitigation when we hit it:**
1. **Shard WS handlers** by `worker_id` modulo N — each handler keeps a slice of workers.
2. **Replace in-memory pub/sub with Redis pub/sub** so any WS-handler instance can publish to any worker.
3. **Adopt Temporal task queues** (see Part 2) — workers long-poll, marketplace doesn't track sockets at all.

---

## Part 2 — Temporal as the Control Plane (when, why, with what guarantees)

### 2.1 What Temporal would replace

Temporal would absorb the **lifecycle/orchestration** plane, leaving the **data plane** (chat tokens) on the existing direct path.

| Current bespoke piece | Temporal replacement |
|---|---|
| Worker outbound WebSocket (Plan 2 Task 6) | Temporal SDK polls a task queue — handles auth, reconnect, backoff |
| In-memory pub/sub `realtime.py` (Plan 4 Task 12) | Workflow `signal` calls — durable, replicated, survive restart |
| `BookingStatus` state machine + `VALID_TRANSITIONS` (Plan 1 Task 9) | `BookingWorkflow` — transitions are workflow code paths |
| Heartbeat REST endpoint + `last_seen_at` | Activity heartbeats — Temporal flags worker offline automatically |
| `pending-events` reconnect drain | Workflow durable execution — events resume on reconnect, no drain needed |
| Cron-based scoring, billing, S3 migration | Scheduled workflows — single primitive |

**Net code removed:** ~300–500 LOC of custom plumbing across worker + marketplace.
**Net code added:** Workflow definitions (Python on marketplace, ~200 LOC), Temporal SDK in worker (Rust, link only, ~10 LOC of setup).

### 2.2 What Temporal does NOT replace

- **Per-token chat streaming.** Temporal isn't designed for low-latency byte streaming. Signals are persisted to history (~100–300 ms overhead each) and bloat workflow event log. Keep WebSocket/HTTP for the data plane.
- **High-frequency metrics.** Heartbeats every 15 s as Temporal activities are fine; sub-second telemetry should still flow over a separate channel (or we batch).
- **Direct consumer ↔ sandbox path.** The data plane stays direct so we can later layer X25519 / Noise on it without the marketplace seeing plaintext.

### 2.3 Hybrid architecture

```
Control plane (durable, low-frequency)              →  Temporal Cloud
  ├─ BookingWorkflow              (pending → active → completed)
  ├─ StartSandboxActivity         (calls SandboxBackend.start, Plan 3)
  ├─ StopSandboxActivity
  ├─ HeartbeatActivity            (15 s interval)
  ├─ ScoringWorkflow              (scheduled, every N min, Plan 5)
  ├─ BillingWorkflow              (per-booking accumulation; later)
  └─ StateBackupWorkflow          (S3 agent state migration; later)

Data plane (high-frequency, low-latency, streaming) →  Direct WS / HTTP
  ├─ Consumer chat messages       marketplace → worker → sandbox
  ├─ Streamed assistant tokens    sandbox → worker → marketplace → consumer
  └─ Real-time CPU/GPU streams    (if added later — currently 15 s polling is fine)
```

### 2.4 Decision rule — when to switch

Stick with the bespoke design in Plans 1–2 until **any** of the following becomes true:

1. **Concurrent active bookings exceed ~50.** Below this, custom code is simpler than Temporal setup.
2. **Marketplace restart loses in-flight bookings.** The moment a single dropped event causes a customer-visible incident, durability earns its keep.
3. **A second worker type appears** (scoring worker, state-migration worker, billing worker). Temporal task queues let the same worker binary handle multiple queues; bespoke code means a new pub/sub channel per type.
4. **Scheduled work is needed.** Cron jobs in FastAPI plugins are workable but operationally fragile. Temporal scheduled workflows are first-class.
5. **You want a debugging UI.** Temporal Cloud's workflow history view is excellent for "what is this booking actually doing right now?".

### 2.5 Encryption — Temporal supports E2E (verified)

Three layers, distinct responsibilities:

#### 2.5.1 Transport (built-in, mandatory)
All connections to Temporal Cloud use **TLS 1.3** regardless of auth method (API keys *or* mTLS client certs). Self-hosted servers should also be configured for TLS — see Temporal's security best practices.

#### 2.5.2 At rest (Temporal Cloud, automatic)
Temporal Cloud encrypts all data at rest with **AES-256-GCM**. For self-hosted, you configure your storage layer (Postgres / Cassandra) for at-rest encryption — Temporal's own DB schema doesn't add anything special.

#### 2.5.3 Application-level / E2E (the interesting one)
Temporal's **Payload Codec** mechanism is the lever that gives us E2E encryption: workflow inputs, outputs, signal payloads, and query results pass through a codec pipeline before they leave the SDK.

```
Application object
    ↓ Payload Converter (toPayload)         ← runs in workflow sandbox; deterministic
Payload (binary)
    ↓ Payload Codec (encode)                ← runs OUTSIDE the workflow sandbox; can do I/O,
Encrypted Payload                              call KMS, do AES-256-GCM, etc.
    ↓ gRPC over TLS 1.3
Temporal Cluster (sees only ciphertext) ────────────────────────────┐
                                                                    ▼
                                                       Stored at rest (already AES-256-GCM
                                                       by the cluster, but our payload is
                                                       already ciphertext, so it's twice-
                                                       encrypted — defence-in-depth)
```

Crucial properties:
- **Keys stay with us.** Temporal never sees the encryption key. We decide where it lives — env var, AWS KMS, HashiCorp Vault, a hardware key on the worker host, etc.
- **Temporal Server sees opaque bytes.** Workflow execution still works because the codec runs on both ends (worker SDK encrypts on send, worker SDK decrypts on receive). The server just shuffles ciphertext.
- **Codec runs outside the workflow sandbox.** Workflow code is required to be deterministic (no I/O, no current time, no randomness); the codec is exempt because it operates on Payloads, not on workflow state. So the codec can call a remote KMS, fetch a per-booking key, etc.
- **Codec Server for UI debugging.** Temporal's Web UI normally shows workflow inputs/outputs as JSON. With a codec, those would appear as base64 ciphertext blobs. To make them readable for ops, you run a **Codec Server** — a small HTTP service the UI calls to decode payloads on the operator's machine. Decoding happens client-side; the server never sees plaintext. The Codec Server is *separate* from Temporal and is operated by us.

#### 2.5.4 What this buys for the v2 hardening goal

Recall the v2 goal in `docs/security-analysis.md`: even the marketplace operator shouldn't see consumer payloads. If we move the booking lifecycle to Temporal *and* register a custom Payload Codec keyed per-booking, we get:

- **Booking metadata** (status, timestamps, IDs) — visible to Temporal Server and us, by design (we need this to run the marketplace).
- **Consumer chat messages routed via signals** — encrypted with a per-booking key. Temporal Server stores ciphertext. Marketplace operator with DB access cannot read messages.
- **Activity payloads** (sandbox specs, agent configs) — encrypted the same way.

This gets close to "trustless marketplace operator" without rolling our own crypto: AES-256-GCM via a well-trodden SDK code path. The remaining gap (and the reason this is v2 not v1) is **key management** — where do per-booking keys come from, how does the consumer establish them with the supplier, how do we rotate them. That's the X25519/Noise design Darkbloom uses; we'd port it on top.

### 2.6 What we'd actually build to adopt Temporal

When the decision rule in §2.4 fires, the migration looks like:

1. **Spin up Temporal Cloud namespace.** Use the credits already mentioned in `plan.md`. ~10 min.
2. **Add Python Temporal SDK to backend.** Define `BookingWorkflow`, `StartSandboxActivity`, `StopSandboxActivity`, `HeartbeatActivity`. ~1 day.
3. **Add Rust Temporal SDK to worker.** Worker registers as a Temporal worker on a per-supplier task queue (`supplier-{supplier_id}`); polls for activities. ~1 day.
4. **Replace `realtime.py` + `/v1/ws/worker`.** Booking activation triggers `WorkflowClient.start_workflow(BookingWorkflow.run, ...)` on the supplier's queue. Delete the WS handler. ~half day.
5. **Add Payload Codec.** Custom codec encrypts signal/activity payloads with AES-256-GCM. Per-booking key fetched from a key-manager service (Vault / our own DB initially). ~1 day.
6. **Stand up Codec Server** for ops. Small Flask/FastAPI app that decodes payloads for the Temporal UI. Hosted behind our auth. ~half day.
7. **Migrate scheduled jobs** (scoring etc.) to Temporal scheduled workflows when they exist. ~half day each.

Total budget: **~1 week** of focused work to flip the control plane to Temporal once we've decided to.

### 2.7 Risks of adopting Temporal

- **Lock-in flavour.** Temporal is open-source (MIT) so technically no lock-in, but Temporal Cloud is the realistic deployment for a startup. Self-hosting Temporal is non-trivial (Cassandra/Postgres, history shards, visibility store).
- **Determinism rules.** Workflow code can't do direct I/O, can't read the wall clock, can't use uncontrolled randomness. Easy to write subtly broken workflows. Mitigated by code review + Temporal's replay test framework.
- **Versioning workflows.** Once a workflow is in flight, you can't change its code without versioning markers (Temporal supports this — `patched` API — but it's a real concept to learn).
- **Larger worker binary.** Rust Temporal SDK adds ~10–15 MB. Acceptable for our use case.

### 2.8 Decision (now)

For v1: **stay with custom WS + REST.** Re-evaluate at the first concurrent-booking pain point or when scheduled jobs become a thing.

For v2: **adopt Temporal for the control plane**, with a custom Payload Codec for per-booking encryption. Keep the data plane direct so streaming token responses remain fast.

### 2.9 Note — Why not Temporal for v1 workers (decided 2026-05-10)

Considered using Temporal as the worker control plane in v1; decided against. Reasoning:

1. **Booking lifecycle is volatile in month one.** `active` will likely split into `provisioning → ready → in_use`, plus future `paused` / `migrating` / `disputed` states. Custom code absorbs that with a 5-line edit. In-flight Temporal workflows need explicit `patched()` versioning markers — fine in steady state, friction during rapid iteration.
2. **The custom plumbing is small.** Plan 2's WebSocket handler (~150 LOC) + pub/sub stub (~30 LOC) + state machine table (~10 LOC). ~200 LOC of throwaway code is cheaper than designing around Temporal's primitives before we've validated the product.
3. **The Temporal feature that matters most to us — Payload Codec for E2E — is a v2 concern.** Adopting Temporal in v1 without the codec buys the operational dependency without the security upside.
4. **MVP velocity beats orchestration elegance.** A Temporal Cloud outage during a demo is a self-inflicted wound; custom code has the same uptime as the rest of the FastAPI app.
5. **Trigger list is documented (§2.4):** 50+ concurrent bookings, any restart-loses-events incident, second worker type, real scheduled jobs, or a "what is this booking doing?" debug pain point. Hit any of those → flip to Temporal in a focused 1-week migration (§2.6).

**Use the Temporal credits productively in v1 anyway:** put the **scoring / ranking subsystem** (originally Plan 5) on Temporal scheduled workflows from day one. Scoring is naturally periodic, durable, off the chat path, and stable in shape — exactly where Temporal pays off without forcing it on a volatile lifecycle.

---

## References

### Reachability
- d-inference architecture (Darkbloom): <https://github.com/Layr-Labs/d-inference>
- Cloudflare Tunnels architecture: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/>
- GitHub self-hosted runners networking: <https://docs.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners#communication-between-self-hosted-runners-and-github>

### Temporal
- [Codecs and Encryption](https://docs.temporal.io/production-deployment/data-encryption)
- [Payload Codec reference](https://docs.temporal.io/payload-codec)
- [How Temporal handles application data](https://docs.temporal.io/dataconversion)
- [Converters and encryption — Python SDK](https://docs.temporal.io/develop/python/converters-and-encryption)
- [Converters and encryption — Go SDK](https://docs.temporal.io/develop/go/converters-and-encryption)
- [Temporal Cloud security model](https://docs.temporal.io/cloud/security)
- [Security controls for Temporal Cloud](https://docs.temporal.io/best-practices/security-controls)
- [How to protect sensitive data in a Temporal Application (blog)](https://temporal.io/blog/how-to-protect-sensitive-data-in-a-temporal-application)
- [Demystify the Temporal Data Converter and Codec Server](https://keithtenzer.com/temporal/demystify_the_temporal_dataconverter_and_codec_server/)
