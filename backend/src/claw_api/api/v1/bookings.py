from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.api.v1._trust import set_trust_headers
from claw_api.chain import ChainSettlementError, settle_on_activate, settle_on_close
from claw_api.crypto import SealError, seal_for_worker
from claw_api.db import get_db
from claw_api.deps import current_user
from claw_api.models.bookings import VALID_TRANSITIONS, Booking, BookingStatus
from claw_api.models.offerings import Offering
from claw_api.models.suppliers import Supplier
from claw_api.models.users import User
from claw_api.models.workers import Worker
from claw_api.realtime import channel_for_worker, publish
from claw_api.schemas.bookings import (
    BookingCreate,
    BookingList,
    BookingOut,
    BookingTransition,
)

router = APIRouter(tags=["bookings"])


@router.post("/bookings", response_model=BookingOut, status_code=201)
async def create_booking(
    payload: BookingCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Booking:
    offering = (
        await db.execute(select(Offering).where(Offering.id == payload.offering_id))
    ).scalar_one_or_none()
    if offering is None or offering.status != "active":
        raise HTTPException(404, "offering not available")
    worker = (
        await db.execute(select(Worker).where(Worker.id == payload.worker_id))
    ).scalar_one_or_none()
    if worker is None or worker.supplier_id != offering.supplier_id:
        raise HTTPException(400, "worker does not belong to offering's supplier")
    booking = Booking(
        consumer_user_id=user.id,
        offering_id=offering.id,
        worker_id=worker.id,
        status=BookingStatus.PENDING.value,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking


@router.get("/bookings/me", response_model=BookingList)
async def my_bookings(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> BookingList:
    rows = (
        await db.execute(
            select(Booking)
            .where(Booking.consumer_user_id == user.id)
            .order_by(Booking.created_at.desc())
        )
    ).scalars().all()
    return BookingList(items=[BookingOut.model_validate(b) for b in rows])


@router.get("/bookings/{booking_id}", response_model=BookingOut)
async def get_booking(
    booking_id: str,
    response: Response,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Booking:
    booking = await _load_party(db, booking_id, user)
    worker = (
        await db.execute(select(Worker).where(Worker.id == booking.worker_id))
    ).scalar_one_or_none()
    if worker is not None:
        set_trust_headers(response, worker)
    return booking


@router.post("/bookings/{booking_id}/transition", response_model=BookingOut)
async def transition_booking(
    booking_id: str,
    payload: BookingTransition,
    response: Response,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Booking:
    booking = await _load_party(db, booking_id, user)
    prev_status = booking.status
    if payload.to not in VALID_TRANSITIONS.get(booking.status, set()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"cannot transition from {booking.status} to {payload.to}",
        )
    offering = (
        await db.execute(select(Offering).where(Offering.id == booking.offering_id))
    ).scalar_one()
    consumer = (
        await db.execute(select(User).where(User.id == booking.consumer_user_id))
    ).scalar_one()
    supplier_row = (
        await db.execute(select(Supplier).where(Supplier.id == offering.supplier_id))
    ).scalar_one()

    # Escrow lock BEFORE the booking goes active: if the consumer can't cover
    # the on-chain lock, the machine never spins up.
    if payload.to == BookingStatus.ACTIVE.value:
        try:
            await settle_on_activate(db, booking, offering, consumer, supplier_row)
        except ChainSettlementError as exc:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"on-chain escrow lock failed: {exc}",
            ) from exc

    booking.status = payload.to
    now = datetime.now(UTC)
    if payload.to == BookingStatus.ACTIVE.value:
        booking.started_at = now
    if payload.to in (BookingStatus.COMPLETED.value, BookingStatus.CANCELLED.value):
        booking.ended_at = now
    await db.commit()
    await db.refresh(booking)

    # Charge actual usage once the booking closes. Best-effort: a chain
    # failure is recorded on the public ledger, the transition stands.
    if prev_status == BookingStatus.ACTIVE.value and payload.to in (
        BookingStatus.COMPLETED.value,
        BookingStatus.CANCELLED.value,
    ):
        await settle_on_close(
            db,
            booking,
            offering,
            consumer,
            supplier_row,
            cancelled=payload.to == BookingStatus.CANCELLED.value,
        )
    # Push to the worker's outbound WebSocket. Fire-and-forget: a missing
    # subscriber just drops the message, the worker reconciles on reconnect.
    channel = channel_for_worker(booking.worker_id)
    worker = (
        await db.execute(select(Worker).where(Worker.id == booking.worker_id))
    ).scalar_one()
    set_trust_headers(response, worker)

    async def _seal_or_plain(inner_type: str, inner: dict) -> None:
        """Seal to the worker's pubkey when it has one, else fall back to
        plaintext (older workers on the pre-attestation build)."""
        try:
            envelope = seal_for_worker(worker.pubkey_x25519, inner_type, inner)
            await publish(channel, envelope)
        except SealError:
            await publish(channel, {"type": inner_type, **inner})

    if payload.to == BookingStatus.ACTIVE.value:
        await _seal_or_plain(
            "booking_activated",
            {
                "booking_id": booking.id,
                "offering_id": booking.offering_id,
                "agent_config": {},
            },
        )
    elif prev_status == BookingStatus.ACTIVE.value and payload.to in (
        BookingStatus.COMPLETED.value,
        BookingStatus.CANCELLED.value,
    ):
        # Cancellation doesn't carry secret content — could ship plaintext,
        # but sealing keeps the WS-log surface homogeneous.
        await _seal_or_plain("booking_cancelled", {"booking_id": booking.id})
    return booking


async def _load_party(db: AsyncSession, booking_id: str, user: User) -> Booking:
    booking = (
        await db.execute(select(Booking).where(Booking.id == booking_id))
    ).scalar_one_or_none()
    if booking is None:
        raise HTTPException(404, "not found")
    if booking.consumer_user_id == user.id:
        return booking
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if supplier is not None:
        offering = (
            await db.execute(select(Offering).where(Offering.id == booking.offering_id))
        ).scalar_one()
        if offering.supplier_id == supplier.id:
            return booking
    raise HTTPException(404, "not found")
