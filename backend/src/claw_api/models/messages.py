from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class Message(Base, IdMixin, TimestampMixin):
    __tablename__ = "messages"
    booking_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bookings.id"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
