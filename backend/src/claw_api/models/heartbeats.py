from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class Heartbeat(Base, IdMixin, TimestampMixin):
    __tablename__ = "heartbeats"
    worker_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workers.id"), index=True, nullable=False
    )
    cpu_pct: Mapped[float] = mapped_column(Float, nullable=False)
    mem_pct: Mapped[float] = mapped_column(Float, nullable=False)
    gpu_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    free_ram_gb: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_loaded_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
