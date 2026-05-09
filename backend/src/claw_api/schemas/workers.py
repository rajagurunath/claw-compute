from datetime import datetime

from pydantic import BaseModel, Field


class ProvisioningTokenRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WorkerOut(BaseModel):
    id: str
    name: str
    status: str
    last_seen_at: datetime | None
    machine_info: dict

    model_config = {"from_attributes": True}


class ProvisioningTokenResponse(BaseModel):
    provisioning_token: str
    worker: WorkerOut


class WorkerRegisterRequest(BaseModel):
    provisioning_token: str
    machine_info: dict = Field(default_factory=dict)


class WorkerRegisterResponse(BaseModel):
    worker_token: str
    worker: WorkerOut


class HeartbeatRequest(BaseModel):
    cpu_pct: float
    mem_pct: float
    gpu_pct: float | None = None
    free_ram_gb: float | None = None
    model_loaded_id: str | None = None


class WorkerList(BaseModel):
    items: list[WorkerOut]
