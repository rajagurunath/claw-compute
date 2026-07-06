# ClawEscrow

USDC settlement rail for Claw Marketplace bookings. Consumers prepay escrow;
the backend (SETTLER_ROLE) mirrors the booking lifecycle on-chain:

```
deposit → openBooking (locks rate × maxDuration)
        → settleBooking / cancelBooking (charges actual usage, releases lock)
        → claim (supplier/treasury) · withdrawUnused (consumer)
```

Key invariants: per-booking fund locks (a consumer can never drain escrow out
from under an open booking), usage bounded by the booked window and wall-clock
time, commission snapshotted per booking and capped at 20%, and `claim`/
`withdrawUnused` keep working while paused.

## Setup

```bash
make contracts-setup   # vendors forge-std + OpenZeppelin into lib/ (gitignored)
forge test             # 17 tests: unit, exploit replays, fuzz solvency invariant
```

## Deploy

Local (anvil deploys a MockUSDC automatically when `USDC_ADDRESS` is unset):

```bash
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 \
  --private-key <anvil key> --broadcast
```

Arc testnet (USDC is the gas token; fund the deployer at faucet.circle.com):

```bash
cast wallet import claw-deployer --interactive   # encrypted keystore, never --private-key
USDC_ADDRESS=0x3600000000000000000000000000000000000000 \
TREASURY=<addr> SETTLER=<addr> \
forge script script/Deploy.s.sol --rpc-url arc_testnet --account claw-deployer --broadcast
```

See `docs/onchain-settlement.md` at the repo root for the full design and the
backend integration.
