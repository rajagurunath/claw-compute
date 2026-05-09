from enum import StrEnum

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class OfferingStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class Offering(Base, IdMixin, TimestampMixin):
    __tablename__ = "offerings"
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("suppliers.id"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    price_per_hour_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    capability_tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)), nullable=False, default=list
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=OfferingStatus.ACTIVE.value
    )
