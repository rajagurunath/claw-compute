"""End-to-end sealing primitives for worker-bound payloads."""

from claw_api.crypto.sealer import SealError, seal_for_worker

__all__ = ["SealError", "seal_for_worker"]
