import asyncio
import secrets
from datetime import UTC, datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claw_api.auth.hashing import hash_token, verify_token
from claw_api.auth.jwt import decode_token, encode_worker_token
from claw_api.db import get_db
from claw_api.deps import current_user, current_worker
from claw_api.models.heartbeats import Heartbeat
from claw_api.models.suppliers import Supplier
from claw_api.models.users import User
from claw_api.models.workers import Worker, WorkerStatus
from claw_api.realtime import channel_for_worker, register, unregister
from claw_api.schemas.workers import (
    HeartbeatRequest,
    ProvisioningTokenRequest,
    ProvisioningTokenResponse,
    WorkerList,
    WorkerOut,
    WorkerRegisterRequest,
    WorkerRegisterResponse,
)

router = APIRouter(tags=["workers"])


async def _supplier_for(db: AsyncSession, user: User) -> Supplier:
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    ).scalar_one_or_none()
    if supplier is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "supplier account required")
    return supplier


@router.post(
    "/workers/provisioning-tokens",
    response_model=ProvisioningTokenResponse,
    status_code=201,
)
async def issue_provisioning_token(
    payload: ProvisioningTokenRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> ProvisioningTokenResponse:
    supplier = await _supplier_for(db, user)
    raw = secrets.token_urlsafe(32)
    worker = Worker(
        supplier_id=supplier.id,
        name=payload.name,
        provisioning_token_hash=hash_token(raw),
        status=WorkerStatus.PENDING.value,
        machine_info={},
    )
    db.add(worker)
    await db.commit()
    await db.refresh(worker)
    return ProvisioningTokenResponse(
        provisioning_token=raw, worker=WorkerOut.model_validate(worker)
    )


@router.post("/workers/register", response_model=WorkerRegisterResponse)
async def register_worker(
    payload: WorkerRegisterRequest, db: AsyncSession = Depends(get_db)
) -> WorkerRegisterResponse:
    candidates = (
        await db.execute(
            select(Worker).where(
                Worker.provisioning_token_hash.is_not(None),
                Worker.status == WorkerStatus.PENDING.value,
            )
        )
    ).scalars().all()
    matched: Worker | None = None
    for w in candidates:
        if w.provisioning_token_hash and verify_token(
            payload.provisioning_token, w.provisioning_token_hash
        ):
            matched = w
            break
    if matched is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid provisioning token")
    matched.status = WorkerStatus.ACTIVE.value
    matched.machine_info = payload.machine_info
    matched.provisioning_token_hash = None
    matched.last_seen_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(matched)
    return WorkerRegisterResponse(
        worker_token=encode_worker_token(matched.id),
        worker=WorkerOut.model_validate(matched),
    )


@router.post("/workers/heartbeat", status_code=204)
async def heartbeat(
    payload: HeartbeatRequest,
    worker: Worker = Depends(current_worker),
    db: AsyncSession = Depends(get_db),
) -> Response:
    worker.last_seen_at = datetime.now(UTC)
    if worker.status == WorkerStatus.OFFLINE.value:
        worker.status = WorkerStatus.ACTIVE.value
    db.add(
        Heartbeat(
            worker_id=worker.id,
            cpu_pct=payload.cpu_pct,
            mem_pct=payload.mem_pct,
            gpu_pct=payload.gpu_pct,
            free_ram_gb=payload.free_ram_gb,
            model_loaded_id=payload.model_loaded_id,
        )
    )
    await db.commit()
    return Response(status_code=204)


@router.get("/suppliers/me/workers", response_model=WorkerList)
async def list_my_workers(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkerList:
    supplier = await _supplier_for(db, user)
    rows = (
        await db.execute(select(Worker).where(Worker.supplier_id == supplier.id))
    ).scalars().all()
    return WorkerList(items=[WorkerOut.model_validate(w) for w in rows])


@router.websocket("/ws/worker")
async def worker_ws(ws: WebSocket) -> None:
    """Outbound-only worker connection. Worker sends Bearer worker_token in the
    `Authorization` header (or `?token=` query param for browser-friendlier clients).
    Server pushes JSON-line booking events; sends `{"type":"ping"}` every 20s
    to keep proxies from idle-closing the connection.
    """
    await ws.accept()
    raw = ws.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if not raw:
        raw = ws.query_params.get("token", "")
    try:
        payload = decode_token(raw)
        if payload.get("kind") != "worker":
            raise ValueError("wrong kind")
    except (InvalidTokenError, ValueError):
        await ws.close(code=4401)
        return
    worker_id = payload["sub"]
    channel = channel_for_worker(worker_id)
    queue = await register(channel)
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=20)
                await ws.send_json(msg)
            except TimeoutError:
                await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        await unregister(channel, queue)
