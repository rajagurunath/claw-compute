from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.db import get_db
from claw_api.deps import current_user
from claw_api.models.suppliers import Supplier
from claw_api.models.users import User
from claw_api.schemas.suppliers import SupplierCreate, SupplierOut, SupplierUpdate

router = APIRouter(tags=["suppliers"])


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def become_supplier(
    payload: SupplierCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    existing = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "user already a supplier")
    supplier = Supplier(
        user_id=user.id,
        display_name=payload.display_name,
        payout_email=str(payload.payout_email),
        payout_wallet=payload.payout_wallet,
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.get("/suppliers/me", response_model=SupplierOut)
async def get_my_supplier(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not a supplier")
    return supplier


@router.patch("/suppliers/me", response_model=SupplierOut)
async def update_my_supplier(
    payload: SupplierUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    """Set the EVM address USDC earnings are paid to."""
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not a supplier")
    supplier.payout_wallet = payload.payout_wallet
    await db.commit()
    await db.refresh(supplier)
    return supplier
