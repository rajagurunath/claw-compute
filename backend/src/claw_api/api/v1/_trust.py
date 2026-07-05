"""Helpers for attaching worker trust-posture headers to responses.

Mirrors Darkbloom's `X-Provider-*` scheme so a caller can programmatically
gate on the trust level of the machine that ran their inference.
"""

from __future__ import annotations

from fastapi import Response

from claw_api.models.workers import TrustLevel, Worker


def set_trust_headers(response: Response, worker: Worker) -> None:
    """Stamp trust-posture headers derived from the worker record.

    Headers:
      * X-Provider-Trust-Level  — none / self_signed / hardware
      * X-Provider-Encrypted    — 1 if this worker receives sealed WS payloads
      * X-Provider-Chip         — reported chip family (e.g. arm64, apple m3)
      * X-Provider-OS           — reported OS
      * X-Provider-Worker-Id    — for downstream verification via
                                  GET /v1/workers/{id}/attestation
    """
    response.headers["X-Provider-Trust-Level"] = worker.trust_level or TrustLevel.NONE.value
    response.headers["X-Provider-Encrypted"] = "1" if worker.pubkey_x25519 else "0"
    info = worker.machine_info or {}
    if chip := (info.get("chip") or info.get("arch")):
        response.headers["X-Provider-Chip"] = str(chip)
    if os_ := info.get("os"):
        response.headers["X-Provider-OS"] = str(os_)
    response.headers["X-Provider-Worker-Id"] = worker.id
