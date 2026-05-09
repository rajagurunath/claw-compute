from typing import Literal

from pydantic import BaseModel, Field

OfferingStatus = Literal["draft", "active", "archived"]


class OfferingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    price_per_hour_cents: int = Field(ge=0)
    capability_tags: list[str] = Field(default_factory=list)
    status: OfferingStatus = "active"


class OfferingUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    price_per_hour_cents: int | None = Field(default=None, ge=0)
    capability_tags: list[str] | None = None
    status: OfferingStatus | None = None


class OfferingOut(BaseModel):
    id: str
    supplier_id: str
    title: str
    description: str
    price_per_hour_cents: int
    capability_tags: list[str]
    status: OfferingStatus

    model_config = {"from_attributes": True}


class OfferingList(BaseModel):
    items: list[OfferingOut]
    total: int
