from fastapi import APIRouter

from claw_api.api.v1 import auth, health

api_v1 = APIRouter(prefix="/v1")
api_v1.include_router(health.router)
api_v1.include_router(auth.router)
