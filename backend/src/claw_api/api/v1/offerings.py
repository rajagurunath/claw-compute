from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.db import get_db
from claw_api.deps import current_user
from claw_api.models.offerings import Offering, OfferingStatus
from claw_api.models.suppliers import Supplier
from claw_api.models.users import User
from claw_api.schemas.offerings import OfferingCreate, OfferingList, OfferingOut, OfferingUpdate

router = APIRouter(tags=["offerings"])


async def _require_supplier(db: AsyncSession, user: User) -> Supplier:
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if supplier is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "supplier account required")
    return supplier


@router.post("/offerings", response_model=OfferingOut, status_code=201)
async def create_offering(
    payload: OfferingCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Offering:
    supplier = await _require_supplier(db, user)
    offering = Offering(
        supplier_id=supplier.id,
        title=payload.title,
        description=payload.description,
        price_per_hour_cents=payload.price_per_hour_cents,
        capability_tags=payload.capability_tags,
        status=payload.status,
    )
    db.add(offering)
    await db.commit()
    await db.refresh(offering)
    return offering


@router.get("/offerings", response_model=OfferingList)
async def browse_offerings(
    db: AsyncSession = Depends(get_db),
    capability: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> OfferingList:
    stmt = select(Offering).where(Offering.status == OfferingStatus.ACTIVE.value)
    if capability:
        stmt = stmt.where(Offering.capability_tags.any(capability))
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    items = (
        await db.execute(
            stmt.order_by(Offering.created_at.desc()).limit(limit).offset(offset)
        )
    ).scalars().all()
    return OfferingList(
        items=[OfferingOut.model_validate(o) for o in items], total=total
    )


@router.get("/offerings/{offering_id}", response_model=OfferingOut)
async def get_offering(offering_id: str, db: AsyncSession = Depends(get_db)) -> Offering:
    offering = (
        await db.execute(select(Offering).where(Offering.id == offering_id))
    ).scalar_one_or_none()
    if offering is None:
        raise HTTPException(404, "not found")
    return offering


@router.patch("/offerings/{offering_id}", response_model=OfferingOut)
async def update_offering(
    offering_id: str,
    payload: OfferingUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Offering:
    supplier = await _require_supplier(db, user)
    offering = (
        await db.execute(
            select(Offering).where(
                Offering.id == offering_id, Offering.supplier_id == supplier.id
            )
        )
    ).scalar_one_or_none()
    if offering is None:
        raise HTTPException(404, "not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(offering, field, value)
    await db.commit()
    await db.refresh(offering)
    return offering


@router.delete("/offerings/{offering_id}", status_code=204)
async def delete_offering(
    offering_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    supplier = await _require_supplier(db, user)
    offering = (
        await db.execute(
            select(Offering).where(
                Offering.id == offering_id, Offering.supplier_id == supplier.id
            )
        )
    ).scalar_one_or_none()
    if offering is None:
        raise HTTPException(404, "not found")
    await db.delete(offering)
    await db.commit()
