from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.api.v1._trust import set_trust_headers
from claw_api.crypto import SealError, seal_for_worker
from claw_api.db import get_db
from claw_api.deps import current_user, current_worker
from claw_api.models.bookings import Booking
from claw_api.models.messages import Message
from claw_api.models.users import User
from claw_api.models.workers import Worker
from claw_api.realtime import channel_for_worker, publish
from claw_api.schemas.messages import MessageCreate, MessageList, MessageOut

router = APIRouter(tags=["messages"])


async def _booking_for_consumer(
    db: AsyncSession, booking_id: str, user_id: str
) -> Booking:
    booking = (
        await db.execute(
            select(Booking).where(
                Booking.id == booking_id, Booking.consumer_user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if booking is None:
        raise HTTPException(404, "not found")
    return booking


@router.post(
    "/bookings/{booking_id}/messages", response_model=MessageOut, status_code=201
)
async def send_message(
    booking_id: str,
    payload: MessageCreate,
    response: Response,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    booking = await _booking_for_consumer(db, booking_id, user.id)
    if booking.status != "active":
        raise HTTPException(409, "booking is not active")
    msg = Message(booking_id=booking.id, role="user", content=payload.content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    worker = (
        await db.execute(select(Worker).where(Worker.id == booking.worker_id))
    ).scalar_one()
    set_trust_headers(response, worker)
    inner = {"booking_id": booking.id, "content": payload.content}
    try:
        envelope = seal_for_worker(worker.pubkey_x25519, "message_user", inner)
        await publish(channel_for_worker(booking.worker_id), envelope)
    except SealError:
        # Older worker without a registered pubkey — fall back to plaintext.
        await publish(
            channel_for_worker(booking.worker_id),
            {"type": "message_user", **inner},
        )
    return msg


@router.get("/bookings/{booking_id}/messages", response_model=MessageList)
async def list_messages(
    booking_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageList:
    await _booking_for_consumer(db, booking_id, user.id)
    rows = (
        await db.execute(
            select(Message)
            .where(Message.booking_id == booking_id)
            .order_by(Message.created_at.asc())
        )
    ).scalars().all()
    return MessageList(items=[MessageOut.model_validate(r) for r in rows])


@router.post(
    "/bookings/{booking_id}/messages/internal",
    response_model=MessageOut,
    status_code=201,
)
async def post_assistant_message(
    booking_id: str,
    payload: MessageCreate,
    worker: Worker = Depends(current_worker),
    db: AsyncSession = Depends(get_db),
) -> Message:
    """Worker-only endpoint: the worker posts the assistant's reply after the
    sandbox produces it. Worker JWT must be the worker that owns the booking.
    """
    booking = (
        await db.execute(select(Booking).where(Booking.id == booking_id))
    ).scalar_one_or_none()
    if booking is None or booking.worker_id != worker.id:
        raise HTTPException(404, "not found")
    msg = Message(booking_id=booking.id, role="assistant", content=payload.content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg
