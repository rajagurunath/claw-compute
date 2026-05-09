from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.auth.jwt import decode_token
from claw_api.db import get_db
from claw_api.models.users import User
from claw_api.models.workers import Worker

_bearer = HTTPBearer(auto_error=False)


async def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    try:
        payload = decode_token(creds.credentials)
    except InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token") from None
    if payload.get("kind") != "user":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "wrong token kind")
    user = (
        await db.execute(select(User).where(User.id == payload["sub"]))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user not found")
    return user


async def current_worker(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> Worker:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    try:
        payload = decode_token(creds.credentials)
    except InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token") from None
    if payload.get("kind") != "worker":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "wrong token kind")
    worker = (
        await db.execute(select(Worker).where(Worker.id == payload["sub"]))
    ).scalar_one_or_none()
    if worker is None or worker.status == "disabled":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "worker not found or disabled")
    return worker
