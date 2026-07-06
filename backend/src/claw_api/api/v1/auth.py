from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.auth import magic_link as ml
from claw_api.auth.jwt import encode_user_token
from claw_api.db import get_db
from claw_api.deps import current_user
from claw_api.models.suppliers import Supplier
from claw_api.models.users import User
from claw_api.schemas.auth import (
    MagicLinkRequest,
    MagicLinkVerify,
    TokenResponse,
    UserOut,
    WalletUpdate,
)

router = APIRouter(tags=["auth"])


class RoleOut(BaseModel):
    is_supplier: bool
    is_consumer: bool


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


@router.put("/me/wallet", response_model=UserOut)
async def set_wallet(
    payload: WalletUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Set the EVM address used for USDC escrow deposits."""
    user.wallet_address = payload.wallet_address
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me/role", response_model=RoleOut)
async def my_role(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> RoleOut:
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    return RoleOut(is_supplier=supplier is not None, is_consumer=True)
