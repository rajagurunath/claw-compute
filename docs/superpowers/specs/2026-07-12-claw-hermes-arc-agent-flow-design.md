# Claw + Hermes agents settling on Arc — end-to-end design

**Date:** 2026-07-12
**Status:** approved (user directed "implement this end to end")

## Goal

A consumer requests a compute **agent** — `openclaw`, `sandbox`, or `hermes` —
**pays in a real Arc transaction**, and only once the payment lands does the
**supplier's machine create the agent**. When the session ends, actual usage is
**deducted from the consumer on-chain** and paid to the supplier + treasury.
Prove the whole path working against **Arc testnet** (contract already live at
`0x98e62BEe68ce896efa58E41d33a5100d5fFa5428`).

Non-goal for this pass (deferred): per-user non-custodial wallets, vector-store
memory, attestation, autonomous tool-use runtime.

## Ground truth (verified 2026-07-12)

- `ClawEscrow` is live on Arc testnet (chain `5042002`), commission `1500` bps,
  USDC ERC-20 `0x3600…0000` (6 dec), treasury `0xD026…88d3`.
- The configured Circle developer-controlled wallet (`CHAIN_SIGNER_MODE=circle`)
  is `0xd026…88d3` — it **holds `SETTLER_ROLE`** and is also the treasury. It
  holds ~1.36 USDC (ERC-20) + native gas, with ~0.9995 USDC already free in
  escrow.
- The chain client (`chain/escrow_client.py`) implements `openBooking`,
  `settleBooking`, `cancelBooking` only. **There is no `deposit`/`approve` leg.**
- `Offering` has no workload attribute; `booking_activated` sends an empty
  `agent_config`.

## Wallet model (custodial, testnet)

Only one funded Circle wallet exists, so the flow is **custodial** for this
pass: the platform Circle wallet is the **consumer escrow source + settler +
treasury**. The supplier is a **distinct `payout_wallet`**. Every leg is a real
on-chain Arc transaction:

| Narrative step | On-chain action | Signer |
|---|---|---|
| Client pays | `approve` + `deposit(amount)` | platform Circle wallet (as consumer) |
| Agent starts | `openBooking(id, consumer, supplier, rate, maxDur)` locks funds | settler |
| Session ends | `settleBooking(id, usage)` deducts usage, pays supplier+treasury | settler |

"Deduct the money from the client" = `escrow[consumer]` drops and
`claimable[supplier]` rises. Consumer address defaults to the platform wallet's
own address (auto-detected from Circle), overridable per user later.

## Components

### 1. Backend
- `Workload` StrEnum `{openclaw, sandbox, inference, hermes}`; `workload` column
  on `Offering` (Alembic migration, default `sandbox`). Surfaced in offering
  schemas + browse + booking.
- `EscrowClient.deposit` / `CircleEscrowClient.deposit`: ERC-20 `approve` then
  escrow `deposit`. Also a read-only `free_escrow_of(consumer)` and
  `consumer_address()` (Circle wallet address).
- `chain/service.py`: before `openBooking`, ensure `freeEscrowOf(consumer) >=
  lock`; if short, `deposit(shortfall)` — the "client pays" tx. New settlement
  kind `deposit`.
- `agent_config` in `booking_activated` populated with
  `{workload, model_id, hermes_agent_id}`. `hermes_agent_id =
  sha256(consumer_user_id + offering_id)[:16]`.
- `SettlementTx.workload` column; `/v1/ledger` returns it; ledger stats unchanged.

### 2. Worker
- `BookingActivated` reads `workload` from `agent_config`.
  - `openclaw` / `sandbox` / `inference`: ephemeral sandbox (today's behavior).
  - `hermes`: same boot + a **persistent named volume** keyed by
    `hermes_agent_id`, and the volume is **not** removed on cancel.
- Docker backend used for local E2E; `agent_config` (incl. workload + hermes id)
  written to `/etc/claw.json` inside the sandbox.

### 3. Frontend
- Offering/booking UI exposes the workload; Hermes card CTA becomes a real
  "Browse Hermes hosts".
- Booking page: "Start agent" runs pay(deposit)+activate; shows the deposit /
  open / settle Arc tx hashes; ledger rows get a workload chip.

### 4. E2E verification (the deliverable)
Backend (Arc) + worker (docker) + web up. Register supplier + worker, create one
offering per workload, book, pay (deposit+lock — real Arc txns), activate → agent
created on the worker, end → settle (deduct — real Arc tx). Verify via arcscan,
`GET /v1/ledger`, and `/browse` screenshots. All suites green.

## Security

- Circle API key + entity secret are secrets: env/secrets-manager only, never
  `NEXT_PUBLIC_*`, worker config, logs, or client responses.
- Arc **testnet only**. Amounts in 6-dec USDC base units; never mix with 18-dec
  native gas.
- Deposit amounts bounded by `CHAIN_MAX_BOOKING_HOURS` × rate so a bug can't
  drain the wallet.

## Testing
- Backend: workload column + migration; deposit leg (faked client); agent_config
  population; ledger workload. pytest.
- Worker: workload parse + hermes volume branch. cargo test (noop backend).
- Web: `pnpm build`.
- Live: the Arc testnet E2E run above.
