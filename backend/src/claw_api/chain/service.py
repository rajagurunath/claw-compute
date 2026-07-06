"""Booking lifecycle → ClawEscrow settlement.

Policy layer between the bookings router and the raw web3 client:

* Settlement applies only when the chain is configured (`CHAIN_ENABLED`) AND
  both parties have wallets. Otherwise bookings flow off-chain exactly as
  before — USDC is a second rail, not a replacement.
* `openBooking` (escrow lock) runs BEFORE the booking flips to active in
  Postgres: if the consumer can't cover the lock, activation fails with 402.
* `settleBooking`/`cancelBooking` run after the off-chain transition and are
  best-effort: a failure is recorded on the public ledger, never hidden, and
  the funds stay locked on-chain until an operator retries.

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


class ChainSettlementError(Exception):
    """openBooking failed — activation must not proceed."""


def _applicable(consumer: User, supplier: Supplier) -> bool:
    s = get_settings()
    return bool(
        s.chain_enabled
        and s.chain_escrow_address
        and s.chain_settler_key
        and consumer.wallet_address
        and supplier.payout_wallet
    )


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
    """Lock rate × max-duration in escrow. Raises ChainSettlementError if the
    lock cannot be placed — the caller must abort the activation."""
    if not _applicable(consumer, supplier):
        return
    s = get_settings()
    max_secs = s.chain_max_booking_hours * 3600
    tx = SettlementTx(
        booking_id=booking.id,
        kind=SettlementTxKind.OPEN,
        consumer_wallet=consumer.wallet_address,
        supplier_wallet=supplier.payout_wallet,
        rate_per_hour_cents=offering.price_per_hour_cents,
        status=SettlementTxStatus.FAILED,  # flipped on success
    )
    try:
        result = await asyncio.to_thread(
            escrow_client.get_escrow_client().open_booking,
            booking.id,
            consumer.wallet_address,
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
    if not _applicable(consumer, supplier):
        return
    usage = _usage_seconds(booking)
    kind = SettlementTxKind.CANCEL if cancelled else SettlementTxKind.SETTLE
    tx = SettlementTx(
        booking_id=booking.id,
        kind=kind,
        consumer_wallet=consumer.wallet_address,
        supplier_wallet=supplier.payout_wallet,
        rate_per_hour_cents=offering.price_per_hour_cents,
        usage_seconds=usage,
        status=SettlementTxStatus.FAILED,
    )
    try:
        client = escrow_client.get_escrow_client()
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
