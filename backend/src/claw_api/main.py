from fastapi import FastAPI

from claw_api.api import distribution
from claw_api.api.v1.router import api_v1


def create_app() -> FastAPI:
    app = FastAPI(title="Claw Marketplace API", version="0.1.0")
    app.include_router(api_v1)
    # Root-level: /install.sh and /releases/... for the worker installer.
    app.include_router(distribution.router)
    return app


app = create_app()
