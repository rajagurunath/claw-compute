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
    trust_level: str = "none"
    pubkey_x25519: str | None = None

    model_config = {"from_attributes": True}


class ProvisioningTokenResponse(BaseModel):
    provisioning_token: str
    worker: WorkerOut


class WorkerRegisterRequest(BaseModel):
    provisioning_token: str
    machine_info: dict = Field(default_factory=dict)
    # base64(32) X25519 public key. Optional so older workers still register.
    pubkey_x25519: str | None = Field(default=None, max_length=64)


class WorkerAttestation(BaseModel):
    """Public attestation record for a worker — safe to expose unauthenticated."""

    id: str
    name: str
    trust_level: str
    pubkey_x25519: str | None
    chip: str | None
    os: str | None
    attested_at: datetime | None
    last_seen_at: datetime | None


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
