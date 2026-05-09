from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class WorkerStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    OFFLINE = "offline"
    DISABLED = "disabled"


class Worker(Base, IdMixin, TimestampMixin):
    __tablename__ = "workers"
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("suppliers.id"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    provisioning_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=WorkerStatus.PENDING.value
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    machine_info: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
