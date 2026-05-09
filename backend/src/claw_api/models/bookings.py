from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class BookingStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


VALID_TRANSITIONS: dict[str, set[str]] = {
    BookingStatus.PENDING.value: {BookingStatus.ACTIVE.value, BookingStatus.CANCELLED.value},
    BookingStatus.ACTIVE.value: {BookingStatus.COMPLETED.value, BookingStatus.CANCELLED.value},
    BookingStatus.COMPLETED.value: set(),
    BookingStatus.CANCELLED.value: set(),
}


class Booking(Base, IdMixin, TimestampMixin):
    __tablename__ = "bookings"
    consumer_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True, nullable=False
    )
    offering_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("offerings.id"), index=True, nullable=False
    )
    worker_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workers.id"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=BookingStatus.PENDING.value
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
