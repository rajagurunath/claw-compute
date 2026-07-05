"""NaCl Box sealing for worker-bound WebSocket events.

Every request destined for a worker (booking activation, chat message)
gets re-encrypted here to the worker's registered X25519 public key with a
fresh ephemeral sender keypair. Wire format:

    {
      "type": "sealed",
      "inner_type": "message_user",          # for routing before decrypt
      "nonce": base64(24 bytes),
      "ephemeral_pubkey": base64(32 bytes),
      "ciphertext": base64(N bytes),
    }

Matches `worker/src/api/ws.rs::SealedEnvelope` exactly.
"""

from __future__ import annotations

import base64
import json
from typing import Any

from nacl.public import Box, PrivateKey, PublicKey
from nacl.utils import random as nacl_random


class SealError(Exception):
    """Raised when a worker cannot receive a sealed payload (e.g. no pubkey
    registered, or the stored key is malformed)."""


def _decode_pubkey(b64: str) -> PublicKey:
    raw = base64.b64decode(b64)
    if len(raw) != 32:
        raise SealError(f"worker pubkey wrong length: {len(raw)}")
    return PublicKey(raw)


def seal_for_worker(
    worker_pubkey_b64: str | None,
    inner_type: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Seal `payload` (a JSON-encodable dict — the inner WorkerEvent, minus its
    `type` wrapper) to the worker's X25519 pubkey.

    Raises SealError if the worker has no registered pubkey. Callers can catch
    and fall back to a plaintext publish for backward-compat during rollout.
    """
    if not worker_pubkey_b64:
        raise SealError("worker has no registered pubkey")

    recipient = _decode_pubkey(worker_pubkey_b64)
    ephemeral_sk = PrivateKey.generate()
    box = Box(ephemeral_sk, recipient)
    nonce = nacl_random(Box.NONCE_SIZE)  # 24 bytes
    # Attach `type` inside the sealed blob too, so the worker's serde path
    # can dispatch the decrypted JSON as a normal WorkerEvent.
    inner = {"type": inner_type, **payload}
    ct = box.encrypt(json.dumps(inner).encode("utf-8"), nonce).ciphertext
    return {
        "type": "sealed",
        "inner_type": inner_type,
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ephemeral_pubkey": base64.b64encode(bytes(ephemeral_sk.public_key)).decode(
            "ascii"
        ),
        "ciphertext": base64.b64encode(ct).decode("ascii"),
    }
