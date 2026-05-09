from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class Supplier(Base, IdMixin, TimestampMixin):
    __tablename__ = "suppliers"
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, index=True, nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    payout_email: Mapped[str] = mapped_column(String(320), nullable=False)
