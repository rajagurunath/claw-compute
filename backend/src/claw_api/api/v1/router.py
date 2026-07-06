from fastapi import APIRouter

from claw_api.api.v1 import (
    auth,
    bookings,
    health,
    ledger,
    messages,
    offerings,
    suppliers,
    workers,
)

api_v1 = APIRouter(prefix="/v1")
api_v1.include_router(health.router)
api_v1.include_router(auth.router)
api_v1.include_router(suppliers.router)
api_v1.include_router(offerings.router)
api_v1.include_router(workers.router)
api_v1.include_router(bookings.router)
api_v1.include_router(messages.router)
api_v1.include_router(ledger.router)
