from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class SettlementTxKind:
    OPEN = "open"
    SETTLE = "settle"
    CANCEL = "cancel"


class SettlementTxStatus:
    CONFIRMED = "confirmed"
    FAILED = "failed"


class SettlementTx(Base, IdMixin, TimestampMixin):
    """One on-chain ClawEscrow call, mirrored for the public ledger.

    Everything here is already public on the chain explorer; this table just
    saves the frontend from having to index the chain itself.
    """

    __tablename__ = "settlement_txs"

    booking_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bookings.id"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(String(12), nullable=False)  # open|settle|cancel
    status: Mapped[str] = mapped_column(String(12), nullable=False)  # confirmed|failed
    tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    block_number: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    consumer_wallet: Mapped[str | None] = mapped_column(String(42), nullable=True)
    supplier_wallet: Mapped[str | None] = mapped_column(String(42), nullable=True)
    rate_per_hour_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 6-decimal USDC base units: the lock for `open`, the charged cost for
    # `settle`/`cancel`.
    amount_usdc: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    commission_usdc: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
