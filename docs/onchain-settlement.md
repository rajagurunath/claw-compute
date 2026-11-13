# Claw Marketplace — On-Chain Settlement (`ClawEscrow`)

> **Status: implemented.** Contract in [`contracts/`](../contracts) (Foundry,
> 17 tests incl. exploit replays + a fuzz solvency invariant), backend
> integration in `backend/src/claw_api/chain/`, public ledger at
> `GET /v1/ledger` and `web /ledger`. See [Runbook](#runbook) and
> [What changed from the plan](#what-changed-from-the-plan) below.

## What this is

An optional **USDC settlement rail** for completed bookings, as an alternative
to the Stripe payout path described in [`plan.md`](../plan.md). It does **not**
introduce new billing logic — it re-expresses the existing `Booking` lifecycle
(`pending → active → completed → cancelled`) on-chain, with money attached.

The FastAPI backend (`claw_api`) already owns the booking state machine and
stamps `started_at` / `ended_at`. That same service acts as the trusted
**settler** that posts usage on-chain. The contract holds consumer escrow,
records each settled booking immutably, splits the marketplace commission, and
lets suppliers withdraw — replacing the Stripe `payout_email` payout with a
`payout_wallet`.

## Target chain

| Environment | Chain | Rationale |
|---|---|---|
| Prototype | **Arc testnet** (chain ID `5042002`) | USDC is the native gas token — one unit of account for fees and settlement. Testnet only today. |
| Production (interim) | **Base mainnet** + USDC (ERC-20) | Until Arc mainnet ships. Same Solidity contract; gas paid in ETH. |

Both are EVM + CCTP, so migrating prototype → production is a config change, not
a rewrite.

## How it maps to the existing schema

The contract is a thin on-chain mirror of tables already in Postgres
(`backend/src/claw_api/models/`).

| Repo concept | Source | On-chain equivalent |
|---|---|---|
| Billable unit | `Booking` | `bookings[bookingId]` |
| `bookingId` | `Booking.id` (`String(36)`) | `bytes32` key |
| Consumer | `Booking.consumer_user_id` | `consumer` wallet address |
| Status transitions | `Booking.status` + `VALID_TRANSITIONS` | `openBooking` → `settleBooking` / `cancelBooking` |
| Usage duration | `Booking.started_at` / `ended_at` | `usageSeconds` argument at settle |
| Rate | `Offering.price_per_hour_cents` | `ratePerHourCents` (converted to 6-dec USDC) |
| Supplier payout | `Supplier.payout_email` | `supplierWallet` address |
| Commission (10–15%) | `plan.md` economics | `commissionBps` → `treasury` |

### Unit conversion (exact, no float)

`Offering.price_per_hour_cents` is an integer number of cents. USDC on Arc/Base
is a 6-decimal ERC-20, so **1 cent = 10 000 USDC base units**:

```
cost = price_per_hour_cents * 10_000 * usageSeconds / 3600
```

All amounts are 6-decimal USDC base units. Native gas on Arc is 18 decimals —
never mix the two.

## Actors and roles

| Role | Who in this repo | Actions |
|---|---|---|
| `Consumer` | user that creates a `Booking` | `deposit`, `withdrawUnused` |
| `Supplier` | `Supplier` row (owns workers/offerings) | `claim` |
| `SETTLER_ROLE` | the `claw_api` FastAPI service signer | `openBooking`, `settleBooking`, `cancelBooking` |
| `ADMIN_ROLE` | project owner / multisig | set `commissionBps`, `pause`, rotate settler |

## State

```solidity
IERC20  usdc;                                 // 6 decimals
uint16  commissionBps;                        // 1000–1500 = 10–15% (plan.md)
address treasury;

mapping(address => uint256) escrow;           // consumer prepaid balance
mapping(address => uint256) claimable;        // supplier earnings (pull-payment)
mapping(bytes32 => Booking) bookings;         // bookingId → Booking

struct Booking {
    address consumer;
    address supplier;
    uint256 ratePerHourCents;
    Status  status;                           // Open | Settled | Cancelled
}
```

## Lifecycle (1:1 with `BookingStatus`)

```
 deposit(amount)                        consumer funds escrow
     │
     ▼
 openBooking(id, consumer,              settler; on pending → active.
             supplierWallet,            reverts if escrow < minimum.
             ratePerHourCents)          ── mirrors BookingStatus.ACTIVE
     │
     ├── settleBooking(id, usageSeconds)
     │       cost = rate * 10_000 * usageSeconds / 3600
     │       escrow[consumer]   -= cost
     │       claimable[supplier]+= cost - commission
     │       claimable[treasury]+= commission
     │       ── mirrors BookingStatus.COMPLETED
     │
     └── cancelBooking(id)              no charge
             ── mirrors BookingStatus.CANCELLED

 claim()                               supplier withdraws USDC
 withdrawUnused(amount)                consumer reclaims leftover escrow
```

`cancelBooking` and `settleBooking` respect the same terminal-state rules as
`VALID_TRANSITIONS` in `models/bookings.py` — a settled or cancelled booking
cannot transition again.

## Interface

```solidity
// consumer
function deposit(uint256 amount) external;
function withdrawUnused(uint256 amount) external;

// settler (claw_api service key)
function openBooking(
    bytes32 bookingId,
    address consumer,
    address supplierWallet,
    uint256 ratePerHourCents
) external onlyRole(SETTLER_ROLE);

function settleBooking(bytes32 bookingId, uint256 usageSeconds)
    external onlyRole(SETTLER_ROLE);

function cancelBooking(bytes32 bookingId) external onlyRole(SETTLER_ROLE);

// supplier
function claim() external;

// admin
function setCommissionBps(uint16 bps) external onlyRole(ADMIN_ROLE);
function setSettler(address settler) external onlyRole(ADMIN_ROLE);
function pause() external onlyRole(ADMIN_ROLE);
```

## Events

The backend indexes these to reconcile the chain against the `bookings` table.

| Event | Emitted by | Purpose |
|---|---|---|
| `Deposited(consumer, amount)` | `deposit` | credit escrow |
| `BookingOpened(bookingId, consumer, supplier, ratePerHourCents)` | `openBooking` | audit start |
| `BookingSettled(bookingId, consumer, supplier, usageSeconds, cost, commission)` | `settleBooking` | **the billing record** |
| `BookingCancelled(bookingId)` | `cancelBooking` | audit cancel |
| `Claimed(supplier, amount)` | `claim` | payout |

## Trust model

MVP uses a **single `claw_api` service key** with `SETTLER_ROLE` to post
settlements. This is consistent with the repo's stated *"Trust-but-verify"*
posture ([`docs/security-analysis.md`](./security-analysis.md)): the backend is
already trusted to transition bookings and measure usage.

**Hardening path (Phase 2).** Note: the worker's existing `pubkey_x25519` is a
key-agreement key — it **cannot sign**, and `ecrecover` only verifies
secp256k1. Worker-co-signed usage receipts therefore need a **separate
secp256k1 signing identity** per worker (generated beside the X25519 key,
registered at attestation). With that in place, `settleBooking` can require a
worker signature over `(bookingId, usageSeconds)` so the backend alone cannot
overbill. Until then, the contract's own bounds (per-booking lock, wall-clock
cap) limit the damage a compromised settler can do.

## Open decisions

1. **Escrow vs. per-second stream.** Prepaid escrow (above) matches "consumer
   pays first, marketplace settles" and is recommended for MVP. A streaming
   model (pay-while-running) is more elegant but heavier — defer.
2. **Second rail vs. replacement.** Recommend adding USDC as a *second payout
   rail* behind the same booking flow rather than replacing Stripe. `Supplier`
   gains an optional `payout_wallet` alongside `payout_email`; the offering/
   booking flow is unchanged.
3. **Receipt signing.** Whether to ship Phase-2 worker-signed receipts at launch
   or after the single-settler MVP proves out.

## Security checklist

- 6-decimal USDC math only; never mix with 18-decimal native gas.
- `ReentrancyGuard` on all fund-moving functions.
- Pull-payment (`claimable` + `claim`), never push transfers to suppliers.
- `Pausable` + role-gated; settler key rotatable via `setSettler`.
- Deploy with an encrypted keystore (`cast wallet import`) — never pass
  `--private-key` as a CLI flag outside local testing.
- Arc is **testnet only** — never target Arc mainnet.

## Toolchain

Foundry (`forge` / `cast`), Solidity, OpenZeppelin (`AccessControl`,
`ReentrancyGuard`, `Pausable`). Arc testnet RPC `https://rpc.testnet.arc.network`,
faucet `https://faucet.circle.com`.

## What changed from the plan

The review found three critical holes in the sketch above; the shipped
contract closes them:

| Hole | Fix in `ClawEscrow.sol` |
|---|---|
| No per-booking reservation — a consumer could `withdrawUnused` mid-booking and leave the supplier unpaid (settle would revert forever) | `openBooking(..., maxDurationSecs)` locks `ceil(rate × maxDuration)` into `lockedOf[consumer]`; `withdrawUnused` can only touch `escrow − locked` |
| Unbounded `usageSeconds` — a buggy/compromised settler could drain escrow | usage must be ≤ `maxDurationSecs` **and** ≤ wall-clock since `openedAt` (+5 min grace); cost is additionally capped by the lock |
| `cancelBooking` charged nothing (free compute), and admin `commissionBps` changes repriced in-flight bookings | `cancelBooking(id, usageSeconds)` settles partial usage; `commissionBps` is snapshotted per booking at open and hard-capped at 20% |

Also: `Status.Unset = 0` guards against acting on nonexistent bookings, and
`claim()` / `withdrawUnused()` are exempt from `pause()` — pause stops money
coming in, never money going out.

### Backend integration (implemented)

* `bookingId (bytes32) = keccak256(utf8(Booking.id))` — canonical derivation.
* **Client pays** — when a consumer has no `wallet_address` (custodial mode),
  `settle_on_activate` first checks `freeEscrowOf(consumer)` and, if it can't
  cover the lock, submits a real `deposit` (`approve` + `deposit`) before
  `openBooking`. Recorded as `settlement_txs.kind = deposit`.
* `openBooking` runs **before** the booking flips to `active` in Postgres; a
  failed deposit/lock aborts activation with HTTP 402. `settle`/`cancel` run
  after the transition, best-effort, with failures recorded (never hidden).
* **Workload** — `offerings.workload` (`openclaw|sandbox|inference|hermes`) is
  snapshotted onto each `settlement_txs` row and shown per-transaction on the
  ledger. The activation event's `agent_config` carries
  `{workload, model_id, hermes_agent_id}` so the worker spins up the right
  agent (Hermes gets a persistent named volume keyed by `hermes_agent_id`).
* Every attempt lands in the `settlement_txs` table → `GET /v1/ledger`
  (public, no auth) → the `/ledger` page. Amounts come from decoding the
  `Deposited` / `BookingOpened` / `BookingSettled` events, not from
  re-computing off-chain.
* Wallets: `users.wallet_address` (consumer escrow) via `PUT /v1/me/wallet`,
  `suppliers.payout_wallet` via `PATCH /v1/suppliers/me`. Bookings whose
  supplier has no payout wallet settle off-chain exactly as before (second
  rail). In custodial mode the platform's Circle wallet is the consumer's
  escrow holder — see below.

### Verified on Arc testnet (2026-07-12)

Deployed `ClawEscrow` at `0x98e62BEe68ce896efa58E41d33a5100d5fFa5428`, signed
by a Circle developer-controlled wallet (`CHAIN_SIGNER_MODE=circle`). The full
product path — **start agent → pay on Arc → deduct on Arc** — was driven end to
end through the HTTP API for a Hermes booking at $0.40/hr, 25s usage:

| Leg | Tx | Amount |
|---|---|---|
| `deposit` (client pays) | `0xee0b83bb…c5942638` | shortfall to cover lock |
| `openBooking` (escrow lock) | `0xa5dac963…03dc9eef2` | $0.40 locked |
| `settleBooking` (deduct + pay supplier) | `0x837d8bee…89a0bb398` | $0.002777 charged, 85/15 split |

Because only one funded Circle wallet exists on testnet, it plays settler +
treasury + custodial consumer; the supplier is a distinct `payout_wallet`.
Per-user non-custodial wallets are a later extension (the code already prefers
`consumer.wallet_address` when set).

## Runbook

### Local demo (anvil)

```bash
# 1. chain + contract
anvil --port 8545 &
cd contracts && forge install --no-git OpenZeppelin/openzeppelin-contracts  # first time
forge test                                    # 17 tests
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 \
  --private-key <anvil key 0> --broadcast     # deploys MockUSDC + ClawEscrow

# 2. fund the consumer wallet (mint/approve/deposit via cast) — see contracts/script

# 3. backend with the rail enabled
CHAIN_ENABLED=true CHAIN_RPC_URL=http://localhost:8545 CHAIN_ID=31337 \
CHAIN_ESCROW_ADDRESS=<escrow> CHAIN_USDC_ADDRESS=<usdc> \
CHAIN_SETTLER_KEY=<anvil key 0> uv run uvicorn claw_api.main:app --port 8001

# 4. web
cd web && NEXT_PUBLIC_API_URL=http://localhost:8001 pnpm dev
```

Set wallets (consumer + supplier payout) in the dashboard → Wallet page, book,
activate, complete — every leg appears on `/ledger`.

### Arc testnet

1. Fund the settler wallet with testnet USDC at https://faucet.circle.com
   (USDC is also the gas token on Arc — one balance covers both).
2. Import the deployer key into an encrypted keystore —
   `cast wallet import claw-deployer --interactive`. **Never** pass
   `--private-key` on Arc, even testnet.
3. `USDC_ADDRESS=0x3600000000000000000000000000000000000000 \
   TREASURY=<multisig> SETTLER=<settler addr> forge script \
   script/Deploy.s.sol --rpc-url arc_testnet --account claw-deployer --broadcast`
4. Backend env: `CHAIN_ENABLED=true`, `CHAIN_RPC_URL=https://rpc.testnet.arc.network`,
   `CHAIN_ID=5042002`, `CHAIN_ESCROW_ADDRESS=<deployed>`,
   `CHAIN_USDC_ADDRESS=0x36…00`, `CHAIN_SETTLER_KEY` from a secrets manager.
5. Arc is **testnet only** — never target Arc mainnet.

### Circle developer-controlled settler

The backend can submit escrow calls through a Circle developer-controlled
wallet instead of holding a raw `CHAIN_SETTLER_KEY`. The wallet must have
`SETTLER_ROLE` on the deployed escrow contract.

```env
CHAIN_ENABLED=true
CHAIN_SIGNER_MODE=circle
CHAIN_RPC_URL=https://rpc.testnet.arc.network
CHAIN_ID=5042002
CHAIN_ESCROW_ADDRESS=<deployed ClawEscrow>
CHAIN_USDC_ADDRESS=0x3600000000000000000000000000000000000000
CIRCLE_API_BASE=https://api.circle.com/v1/w3s
CIRCLE_API_KEY=<Circle sandbox API key>
CIRCLE_ENTITY_SECRET=<registered entity secret>
CIRCLE_WALLET_ID=<ARC-TESTNET developer-controlled wallet UUID>
```

`CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` are secrets. Keep them in the local
environment or a secrets manager; never expose them through `NEXT_PUBLIC_*`,
worker configuration, logs, or client responses.
