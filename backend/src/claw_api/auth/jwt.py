from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from claw_api.config import get_settings


def encode_user_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "kind": "user",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_user_ttl_hours)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
