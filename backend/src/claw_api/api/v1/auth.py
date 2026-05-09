from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.auth import magic_link as ml
from claw_api.auth.jwt import encode_user_token
from claw_api.db import get_db
from claw_api.deps import current_user
from claw_api.models.users import User
from claw_api.schemas.auth import MagicLinkRequest, MagicLinkVerify, TokenResponse, UserOut

router = APIRouter(tags=["auth"])


@router.post("/auth/magic-link", status_code=202)
async def request_magic_link(
    payload: MagicLinkRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    raw = await ml.issue_magic_link(db, payload.email)
    await ml.deliver_magic_link(payload.email, raw)
    return {"status": "sent"}


@router.post("/auth/verify", response_model=TokenResponse)
async def verify_magic_link(
    payload: MagicLinkVerify, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    user = await ml.consume_magic_link(db, payload.token)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired token")
    return TokenResponse(access_token=encode_user_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)) -> User:
    return user
