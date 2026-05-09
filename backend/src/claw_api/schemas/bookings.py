from datetime import datetime
from typing import Literal

from pydantic import BaseModel

BookingStatus = Literal["pending", "active", "completed", "cancelled"]


class BookingCreate(BaseModel):
    offering_id: str
    worker_id: str


class BookingTransition(BaseModel):
    to: BookingStatus


class BookingOut(BaseModel):
    id: str
    consumer_user_id: str
    offering_id: str
    worker_id: str
    status: BookingStatus
    started_at: datetime | None
    ended_at: datetime | None

    model_config = {"from_attributes": True}


class BookingList(BaseModel):
    items: list[BookingOut]
