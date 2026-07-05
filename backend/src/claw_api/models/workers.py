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


class TrustLevel(StrEnum):
    """Public-facing attestation posture. Mirrors Darkbloom's tiers.

    * none         — no attestation info recorded (shouldn't be admitted to
                     private traffic in a stricter deploy).
    * self_signed  — worker holds an X25519 identity we've bound and can
                     re-verify via challenge-response.
    * hardware     — attestation chain rooted in Apple MDA / Secure Enclave
                     (Phase 3, not implemented yet).
    """

    NONE = "none"
    SELF_SIGNED = "self_signed"
    HARDWARE = "hardware"


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
    # base64 of the worker's X25519 identity public key. Populated when the
    # worker version supports sealed events; NULL means fallback to plaintext.
    pubkey_x25519: Mapped[str | None] = mapped_column(String(64), nullable=True)
    trust_level: Mapped[str] = mapped_column(
        String(16), nullable=False, default=TrustLevel.NONE.value
    )
    attested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
