"""Public settlement ledger.

Everything served here is already public on the chain explorer — this
endpoint just saves clients from indexing the chain. No auth on purpose:
usage and payouts are visible to every marketplace participant.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.config import get_settings
from claw_api.db import get_db
from claw_api.models.bookings import Booking
from claw_api.models.offerings import Offering
from claw_api.models.settlements import (
    SettlementTx,
    SettlementTxKind,
    SettlementTxStatus,
)
from claw_api.models.suppliers import Supplier
from claw_api.schemas.ledger import (
    ChainInfo,
    LedgerEntry,
    LedgerOut,
    LedgerStats,
)

router = APIRouter(tags=["ledger"])


@router.get("/ledger", response_model=LedgerOut)
async def public_ledger(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    booking_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> LedgerOut:
    s = get_settings()

    entries_q = (
        select(SettlementTx, Offering.title, Supplier.display_name)
        .join(Booking, Booking.id == SettlementTx.booking_id)
        .join(Offering, Offering.id == Booking.offering_id)
        .join(Supplier, Supplier.id == Offering.supplier_id)
        .order_by(SettlementTx.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if booking_id is not None:
        entries_q = entries_q.where(SettlementTx.booking_id == booking_id)
    rows = (await db.execute(entries_q)).all()
    total = (await db.execute(select(func.count(SettlementTx.id)))).scalar_one()

    confirmed = SettlementTx.status == SettlementTxStatus.CONFIRMED
    closes = (SettlementTx.kind.in_((SettlementTxKind.SETTLE, SettlementTxKind.CANCEL))) & confirmed
    opens = (SettlementTx.kind == SettlementTxKind.OPEN) & confirmed

    settled_volume, commission, settlements = (
        await db.execute(
            select(
                func.coalesce(func.sum(SettlementTx.amount_usdc), 0),
                func.coalesce(func.sum(SettlementTx.commission_usdc), 0),
                func.count(SettlementTx.id),
            ).where(closes)
        )
    ).one()

    opened_bookings = select(SettlementTx.booking_id).where(opens)
    closed_bookings = select(SettlementTx.booking_id).where(closes)
    still_open = opened_bookings.where(SettlementTx.booking_id.not_in(closed_bookings))

    open_count = (
        await db.execute(select(func.count()).select_from(still_open.subquery()))
    ).scalar_one()
    locked_volume = (
        await db.execute(
            select(func.coalesce(func.sum(SettlementTx.amount_usdc), 0)).where(
                opens & SettlementTx.booking_id.in_(
                    select(still_open.subquery().c.booking_id)
                )
            )
        )
    ).scalar_one()

    return LedgerOut(
        chain=ChainInfo(
            enabled=s.chain_enabled and bool(s.chain_escrow_address),
            chain_name=s.chain_name,
            chain_id=s.chain_id,
            explorer_url=s.chain_explorer_url,
            escrow_address=s.chain_escrow_address,
            usdc_address=s.chain_usdc_address,
            commission_bps=s.chain_commission_bps,
        ),
        stats=LedgerStats(
            settled_volume_usdc=int(settled_volume),
            commission_usdc=int(commission),
            locked_volume_usdc=int(locked_volume),
            settlements=int(settlements),
            open_bookings=int(open_count),
        ),
        items=[
            LedgerEntry(
                id=tx.id,
                booking_id=tx.booking_id,
                kind=tx.kind,  # type: ignore[arg-type]
                status=tx.status,  # type: ignore[arg-type]
                tx_hash=tx.tx_hash,
                block_number=tx.block_number,
                consumer_wallet=tx.consumer_wallet,
                supplier_wallet=tx.supplier_wallet,
                supplier_name=supplier_name,
                offering_title=offering_title,
                rate_per_hour_cents=tx.rate_per_hour_cents,
                usage_seconds=tx.usage_seconds,
                amount_usdc=tx.amount_usdc,
                commission_usdc=tx.commission_usdc,
                error=tx.error,
                created_at=tx.created_at,
            )
            for tx, offering_title, supplier_name in rows
        ],
        total=int(total),
    )
