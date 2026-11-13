# Claw Marketplace End-to-End QA Report

Date: 2026-07-11 (Asia/Kolkata)  
Branch: `ci/worker-release-automation`  
Host: macOS 15.7.7, Apple Silicon  
Original verdict: **Not end-to-end complete**  
Remediation verdict (2026-07-12): **Core end-to-end path passes**

## Remediation verification — 2026-07-12

The failures documented below were fixed and re-tested without mocks at the
marketplace/API and blockchain layers. A controlled OpenAI-compatible inference
server was used so the proof does not depend on downloading a multi-gigabyte
MLX model.

### Passing combined lifecycle

- Booking: `019f5289-ae59-73e2-af31-802c21b06e55`
- Escrow: `0x98e62BEe68ce896efa58E41d33a5100d5fFa5428` on ARC Testnet.
- Worker selected the new Docker backend.
- Sandbox started with a unique loopback host port and reported the correct booking ID.
- Client prompt crossed API → worker WebSocket → Docker sandbox → inference.
- Assistant response `PONG` returned to the marketplace transcript.
- `openBooking` confirmed through the Circle developer-controlled SCA:
  `0xc86cbabc6507c0ce03590c9d1803fe31509977effde7494df267155236abd0b4`.
- `settleBooking` confirmed through Circle W3S:
  `0x180293431410f21cd9442e7391e8aa1da0d5dd5a6647970031f45dea9a1925b3`.
- Seven seconds of usage charged 194 USDC base units; commission was 29 base units.
- Both transactions appeared as `confirmed` in `GET /v1/ledger`.
- Booking completion removed the Docker sandbox.

### Fixes applied

- Added a Docker Desktop sandbox backend with dynamic loopback port publishing.
- Made Docker the preferred macOS 14/15 runtime when its daemon is healthy.
- Aligned the worker image reference with the built `0.1.0` image.
- Moved slow sandbox/model handling behind an ordered event queue so the
  WebSocket reader stays responsive.
- Added configurable external inference and a switch to disable local MLX
  pre-warming for managed inference endpoints.
- Removed worker JWTs from process command-line arguments.
- Added Circle developer-controlled-wallet contract execution to the backend.
- Deployed `ClawEscrow` to ARC Testnet with the Circle SCA as admin, treasury,
  and settler.
- Replaced the undersized development JWT secret.

## Executive summary

The API, frontend, supplier onboarding, worker registration, worker heartbeats,
Circle developer wallet, ARC Testnet transfer, automated backend tests, worker
tests, Solidity tests, and frontend production build work.

The live core product loop does not currently complete. A consumer can create a
booking and transition it to `active`, but the worker WebSocket closes, the
activation event is not processed, the Lima sandbox does not start, and a chat
message receives no assistant response. The API therefore reports an active
booking even though no compute was provisioned.

Circle ARC connectivity was proven with a real 0.0001 test-USDC transfer. That
transaction is independent of the marketplace ledger. The marketplace backend
has `CHAIN_ENABLED=false` and no escrow address, and it expects a raw
`CHAIN_SETTLER_KEY`; the supplied Circle developer-controlled wallet credentials
cannot be substituted for that signer without an integration change.

## Environment started

- Postgres 15 in Docker: running and healthy on port 5432.
- FastAPI: running on `http://localhost:8000`.
- Next.js: running on `http://localhost:3000`.
- Persistent terminal session: `tmux attach -t claw-marketplace`.
- API log file: `.logs/api.log`.
- Agent image built: `claw/agent-base:0.1.0` and `claw/agent-base:latest`.
- Worker release binary built for `aarch64-apple-darwin`.

## Results

| Area | Result | Evidence |
|---|---|---|
| Postgres startup and migration | PASS | Container healthy; Alembic completed. |
| API health | PASS | `GET /v1/health` returned 200 and `{"status":"ok"}`. |
| API docs | PASS | `GET /docs` returned 200. |
| Frontend home | PASS | `GET /` on port 3000 returned 200. |
| Public ledger endpoint | PASS with concern | `GET /v1/ledger` returned 200, but chain integration is disabled. Existing dev DB contained six prior ledger rows. |
| Supplier creation | PASS | `POST /v1/suppliers` returned 201. |
| Offering creation | PASS | `POST /v1/offerings` returned 201. |
| Provisioning token | PASS | `POST /v1/workers/provisioning-tokens` returned 201. |
| Worker registration | PASS | `POST /v1/workers/register` returned 200. |
| Worker heartbeat | PASS | Repeated `POST /v1/workers/heartbeat` calls returned 204. |
| Worker WebSocket | FAIL | Connected once, later closed, and did not establish a usable relay connection. |
| Consumer booking creation | PASS | Returned 201 and a pending booking. |
| Booking activation API | PASS at HTTP layer, FAIL operationally | Returned 200/active while no sandbox started. |
| Lima sandbox | FAIL | `claw-sandbox-host` remained stopped; no booking container was created. |
| Consumer chat API | PASS at HTTP layer | Message creation returned 201. |
| Assistant response | FAIL | Transcript still contained only the user message after 12 seconds. |
| Claw/Hermes runtime | NOT AVAILABLE | README explicitly lists OpenClaw/Hermes integration as v2/deferred. Current worker only launches the generic agent image with MLX. |
| Circle W3S wallet lookup | PASS | Configured wallet matched, was `LIVE`, on `ARC-TESTNET`, with 2.5121 test USDC before transfer. |
| Circle ARC transfer | PASS | 0.0001 test USDC completed and the ARC RPC receipt had status `0x1`. |
| Marketplace ARC escrow lifecycle | BLOCKED | `CHAIN_ENABLED=false`, escrow address empty, and no backend-compatible settler key/deployment supplied. |
| Backend automated tests | PASS | 49 passed in 5.28 seconds. |
| Worker automated tests | PASS | 22 passed after granting localhost socket access. |
| Solidity tests | PASS | 17 passed, including exploit replays and fuzz invariant. |
| Frontend production build | PASS | Next.js compiled, type-checked, and generated all routes. |

## Exact client requests used for the live booking

Secrets and authorization headers are omitted.

```http
POST /v1/bookings
Content-Type: application/json

{
  "offering_id": "019f50a6-e5b0-7272-a4a1-c513ce155ff4",
  "worker_id": "019f50a6-e5ff-7df2-9679-9e78e06a2ae3"
}
```

Response booking ID: `019f50a8-1218-7ef0-929a-1ca12217b20a`, status `pending`.

```http
POST /v1/bookings/019f50a8-1218-7ef0-929a-1ca12217b20a/transition
Content-Type: application/json

{"to":"active"}
```

Response status: `active`.

```http
POST /v1/bookings/019f50a8-1218-7ef0-929a-1ca12217b20a/messages
Content-Type: application/json

{"content":"Reply with PONG from the sandbox"}
```

Response status: 201. Subsequent `GET .../messages` returned one message, the
user message only.

## Circle ARC transaction evidence

- Network: ARC Testnet, chain ID 5042002.
- Amount: 0.0001 test USDC.
- Circle transaction ID: `c9a4427c-4c51-5f95-9ccf-6341ba0da496`.
- Transaction hash: `0xebef44b3e35c5c4ff69e3d7a9e1fbbfda7c11ee64d21fc85b8749dfed9cdfe55`.
- ARC RPC receipt: success (`status=0x1`), block `0x30e027a`.
- Explorer: <https://testnet.arcscan.app/tx/0xebef44b3e35c5c4ff69e3d7a9e1fbbfda7c11ee64d21fc85b8749dfed9cdfe55>

This proves Circle W3S signing and ARC settlement connectivity, but it does not
prove `ClawEscrow.openBooking/settleBooking/claim`. The current marketplace API
did not submit this transaction and does not index it in `/v1/ledger`.

## Defects and blockers

### Critical: API reports active before worker provisioning is acknowledged

The booking transition commits `active` and publishes a best-effort in-memory
event. There is no worker acknowledgement or sandbox-ready state. In the live
test the event was not processed, yet the consumer-facing state remained
active. This can charge or mislead a consumer while no compute exists.

Recommended fix: add an activation handshake (`pending -> provisioning -> active`),
persist the command, require worker acknowledgement with a sandbox ID/health
check, and fail or time out safely.

### High: worker WebSocket became closed and live events were lost

The worker logged `ws connected`; the API later logged `connection closed`.
The worker process continued heartbeats, but did not process booking or chat
events. The in-memory pub/sub has no durability or replay, so any event sent
while disconnected is permanently lost.

Recommended fix: investigate the closed socket/reconnect stall, add a live
integration test covering more than connection acceptance, persist events, and
reconcile active bookings after reconnect.

### High: worker token is exposed in the OS process command line

`make worker-run` invokes:

```text
claw-worker run --worker-token <JWT>
```

The token is visible to local process inspection. The QA worker token used in
this run should be revoked/rotated.

Recommended fix: use the environment or Keychain internally and never append
the token as a CLI argument. Redact process and diagnostic output.

### High: Circle wallet integration and marketplace escrow signer are incompatible

The supplied Circle environment contains `CIRCLE_API_KEY`,
`CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_ID`, and token IDs. The backend requires
`CHAIN_ESCROW_ADDRESS` and `CHAIN_SETTLER_KEY` and signs contract calls directly
with Web3. No adapter submits contract executions through Circle W3S.

Recommended fix: choose one supported signing model. Either deploy the escrow
and supply a dedicated backend settler key, or implement a Circle W3S contract
execution adapter and document the required wallet/role setup.

### Medium: image tag mismatch in documented build versus worker runtime

The image build produced `claw/agent-base:0.1.0`; the worker hard-codes
`claw/agent-base:0.1`. A correctly built local image will not satisfy the worker
without an extra tag.

Recommended fix: derive both from one version constant or have the build script
also tag the exact worker reference.

### Medium: Lima backend lacks host port forwarding

The Lima backend runs Docker without `-p`, yet returns `forwarded_port=8080` and
the worker later calls `127.0.0.1:8080`. Even after image/startup issues are
fixed, the host cannot reliably reach the container using that mapping.

Recommended fix: allocate a host port, pass `-p host:8080`, store that host
port, and test simultaneous bookings for collisions.

### Medium: development JWT secret is below the recommended HS256 length

API logs repeatedly report an HMAC key length of 31 bytes, below the 32-byte
minimum recommendation.

Recommended fix: replace the local secret with at least 32 random bytes and
validate secret length during application startup.

### Scope gap: Hermes/OpenClaw is marketing/deferred, not executable here

The repository README says OpenClaw/Hermes integration is deferred to v2. The
current checkout cannot honestly be called complete for those workload types.

## Logs and inspection

Attach to the live terminal session:

```bash
tmux attach -t claw-marketplace
```

Useful commands:

```bash
tmux list-windows -t claw-marketplace
tail -F .logs/api.log
make status
curl -sS http://localhost:8000/v1/health
curl -sS http://localhost:8000/v1/ledger | jq
```

Never paste or publish raw magic-link tokens, JWTs, Circle API keys, entity
secrets, or wallet signer material from these logs.

## Ship-readiness

The public web/API shell and isolated components are in good shape, but the
marketplace's defining supplier-to-consumer compute loop is broken in a live
run. Do not describe this checkout as end-to-end complete until a booking
cannot become active without a healthy sandbox, live relay survives reconnects,
and an actual `ClawEscrow` lifecycle appears in `/v1/ledger` on the intended
test network.
