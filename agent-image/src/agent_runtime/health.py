from fastapi import APIRouter

from agent_runtime.config import booking_id, model_id

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "booking_id": booking_id(), "model_id": model_id()}
