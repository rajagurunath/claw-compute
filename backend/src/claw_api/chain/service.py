"""Booking lifecycle → ClawEscrow settlement.

Policy layer between the bookings router and the raw web3 client:

* Settlement applies when the chain is configured (`CHAIN_ENABLED`) AND the
  supplier has a `payout_wallet` to be paid into. Otherwise bookings flow
  off-chain exactly as before — USDC is a second rail, not a replacement.
* The consumer's escrow address is either their own `wallet_address` (they
  fund their escrow themselves) or, when they have none, the platform's
  custodial signer wallet. In the custodial case `openBooking` is preceded by
  a real **deposit** ("the client pays") whenever free escrow can't cover the
  lock — this is the on-chain payment that gates agent creation.
* `openBooking` (escrow lock) runs BEFORE the booking flips to active in
  Postgres: if the deposit or lock fails, activation fails with 402 and the
  machine never spins up.
* `settleBooking`/`cancelBooking` run after the off-chain transition and are
  best-effort: a failure is recorded on the public ledger, never hidden.

Every attempt — confirmed or failed — is written to `settlement_txs`, which
is what `/v1/ledger` serves to everyone.
"""

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.chain import escrow_client
from claw_api.config import get_settings
from claw_api.models.bookings import Booking
from claw_api.models.offerings import Offering
from claw_api.models.settlements import (
    SettlementTx,
    SettlementTxKind,
    SettlementTxStatus,
)
from claw_api.models.suppliers import Supplier
from claw_api.models.users import User

log = logging.getLogger(__name__)

# 1 cent = 10_000 base units of 6-decimal USDC (matches ClawEscrow.CENT).
_CENT = 10_000


class ChainSettlementError(Exception):
    """Deposit or openBooking failed — activation must not proceed."""


def _signer_configured(s) -> bool:
    return bool(
        s.chain_settler_key
        or (
            s.chain_signer_mode == "circle"
            and s.circle_api_key
            and s.circle_entity_secret
            and s.circle_wallet_id
        )
    )


def _applicable(supplier: Supplier) -> bool:
    """Chain settlement is on when the rail is configured and the supplier has
    a payout wallet. The consumer never needs to manage a wallet — the platform
    custodies escrow for them."""
    s = get_settings()
    return bool(
        s.chain_enabled
        and s.chain_escrow_address
        and _signer_configured(s)
        and supplier.payout_wallet
    )


def _lock_amount(rate_per_hour_cents: int, max_secs: int) -> int:
    """Worst-case USDC (base units) a booking can cost, rounded up — matches
    ClawEscrow's ceil(rate × CENT × maxDuration / 3600)."""
    num = rate_per_hour_cents * _CENT * max_secs
    return 0 if num == 0 else (num - 1) // 3600 + 1


def _usage_seconds(booking: Booking) -> int:
    if booking.started_at is None or booking.ended_at is None:
        return 0
    return max(0, int((booking.ended_at - booking.started_at).total_seconds()))


async def settle_on_activate(
    db: AsyncSession,
    booking: Booking,
    offering: Offering,
    consumer: User,
    supplier: Supplier,
) -> None:
    """Ensure escrow is funded (deposit if custodial + short), then lock
    rate × max-duration. Raises ChainSettlementError if either fails — the
    caller must abort the activation."""
    if not _applicable(supplier):
        return
    s = get_settings()
    max_secs = s.chain_max_booking_hours * 3600
    client = escrow_client.get_escrow_client()

    # Where the consumer's escrow lives: their own wallet if they set one, else
    # the platform's custodial signer wallet.
    custodial = consumer.wallet_address is None
    consumer_addr = consumer.wallet_address or await asyncio.to_thread(
        client.consumer_address
    )

    # "The client pays": top up custodial escrow to cover the lock.
    if custodial:
        lock = _lock_amount(offering.price_per_hour_cents, max_secs)
        try:
            free = await asyncio.to_thread(client.free_escrow_of, consumer_addr)
            if free < lock:
                await _deposit(db, booking, offering, consumer_addr, lock - free)
        except ChainSettlementError:
            raise
        except Exception as exc:  # noqa: BLE001 — a funding failure blocks activation
            msg = _short_error(exc)
            log.warning("escrow funding failed for booking %s: %s", booking.id, msg)
            raise ChainSettlementError(msg) from exc

    tx = SettlementTx(
        booking_id=booking.id,
        kind=SettlementTxKind.OPEN,
        workload=offering.workload,
        consumer_wallet=consumer_addr,
        supplier_wallet=supplier.payout_wallet,
        rate_per_hour_cents=offering.price_per_hour_cents,
        status=SettlementTxStatus.FAILED,  # flipped on success
    )
    try:
        result = await asyncio.to_thread(
            client.open_booking,
            booking.id,
            consumer_addr,
            supplier.payout_wallet,
            offering.price_per_hour_cents,
            max_secs,
        )
    except Exception as exc:  # noqa: BLE001 — any chain failure blocks activation
        tx.error = _short_error(exc)
        db.add(tx)
        await db.commit()
        log.warning("openBooking failed for booking %s: %s", booking.id, tx.error)
        raise ChainSettlementError(tx.error) from exc

    tx.status = SettlementTxStatus.CONFIRMED
    tx.tx_hash = result.tx_hash
    tx.block_number = result.block_number
    if result.event:
        tx.amount_usdc = int(result.event.get("lockedAmount", 0))
    db.add(tx)
    await db.commit()


async def _deposit(
    db: AsyncSession,
    booking: Booking,
    offering: Offering,
    consumer_addr: str,
    amount: int,
) -> None:
    """Fund custodial escrow with a real on-chain deposit, recorded on the
    ledger. Raises ChainSettlementError on failure."""
    tx = SettlementTx(
        booking_id=booking.id,
        kind=SettlementTxKind.DEPOSIT,
        workload=offering.workload,
        consumer_wallet=consumer_addr,
        amount_usdc=amount,
        status=SettlementTxStatus.FAILED,
    )
    try:
        result = await asyncio.to_thread(
            escrow_client.get_escrow_client().deposit, amount
        )
    except Exception as exc:  # noqa: BLE001
        tx.error = _short_error(exc)
        db.add(tx)
        await db.commit()
        raise ChainSettlementError(tx.error) from exc
    tx.status = SettlementTxStatus.CONFIRMED
    tx.tx_hash = result.tx_hash
    tx.block_number = result.block_number
    db.add(tx)
    await db.commit()


async def settle_on_close(
    db: AsyncSession,
    booking: Booking,
    offering: Offering,
    consumer: User,
    supplier: Supplier,
    cancelled: bool,
) -> None:
    """Charge actual usage (settle) or partial usage (cancel). Best-effort:
    failures land on the ledger, the off-chain transition stands."""
    if not _applicable(supplier):
        return
    client = escrow_client.get_escrow_client()
    consumer_addr = consumer.wallet_address or await asyncio.to_thread(
        client.consumer_address
    )
    usage = _usage_seconds(booking)
    kind = SettlementTxKind.CANCEL if cancelled else SettlementTxKind.SETTLE
    tx = SettlementTx(
        booking_id=booking.id,
        kind=kind,
        workload=offering.workload,
        consumer_wallet=consumer_addr,
        supplier_wallet=supplier.payout_wallet,
        rate_per_hour_cents=offering.price_per_hour_cents,
        usage_seconds=usage,
        status=SettlementTxStatus.FAILED,
    )
    try:
        call = client.cancel_booking if cancelled else client.settle_booking
        result = await asyncio.to_thread(call, booking.id, usage)
    except Exception as exc:  # noqa: BLE001 — recorded, not raised
        tx.error = _short_error(exc)
        db.add(tx)
        await db.commit()
        log.warning("%sBooking failed for booking %s: %s", kind, booking.id, tx.error)
        return

    tx.status = SettlementTxStatus.CONFIRMED
    tx.tx_hash = result.tx_hash
    tx.block_number = result.block_number
    if result.event:
        tx.amount_usdc = int(result.event.get("cost", 0))
        tx.commission_usdc = int(result.event.get("commission", 0))
    db.add(tx)
    await db.commit()


def _short_error(exc: Exception) -> str:
    data = getattr(exc, "data", None)
    if data is not None:
        if isinstance(data, tuple | list) and data:
            data = data[0]
        decoded = escrow_client.decode_custom_error(data)
        if decoded:
            return decoded
    return f"{type(exc).__name__}: {exc}"[:500]
