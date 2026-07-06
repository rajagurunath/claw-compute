from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from claw_api.models.base import Base, IdMixin, TimestampMixin


class User(Base, IdMixin, TimestampMixin):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    # EVM address used for USDC escrow deposits (optional second rail).
    wallet_address: Mapped[str | None] = mapped_column(String(42), nullable=True)
