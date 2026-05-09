import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.auth.hashing import hash_token, verify_token
from claw_api.config import get_settings
from claw_api.models.magic_links import MagicLinkToken
from claw_api.models.users import User

logger = logging.getLogger(__name__)


async def issue_magic_link(db: AsyncSession, email: str) -> str:
    settings = get_settings()
    raw = secrets.token_urlsafe(32)
    record = MagicLinkToken(
        email=email.lower(),
        token_hash=hash_token(raw),
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.magic_link_ttl_minutes),
    )
    db.add(record)
    await db.commit()
    return raw


async def deliver_magic_link(email: str, token: str) -> None:
    """Send the magic link. Dev mode logs to console; prod (later) sends SMTP."""
    settings = get_settings()
    if settings.magic_link_delivery == "console":
        logger.warning("MAGIC LINK for %s: token=%s", email, token)
    else:
        raise NotImplementedError("SMTP delivery not implemented in v1")


async def consume_magic_link(db: AsyncSession, raw: str) -> User | None:
    """Verify the raw token, mark used, return-or-create the user."""
    now = datetime.now(UTC)
    candidates = (
        await db.execute(
            select(MagicLinkToken).where(
                MagicLinkToken.used_at.is_(None),
                MagicLinkToken.expires_at > now,
            )
        )
    ).scalars().all()

    for candidate in candidates:
        if verify_token(raw, candidate.token_hash):
            candidate.used_at = now
            user = (
                await db.execute(select(User).where(User.email == candidate.email))
            ).scalar_one_or_none()
            if user is None:
                user = User(email=candidate.email)
                db.add(user)
            await db.commit()
            await db.refresh(user)
            return user
    return None
