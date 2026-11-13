import json
import os
from functools import lru_cache
from pathlib import Path

CONFIG_PATH = Path(os.environ.get("CLAW_CONFIG_PATH", "/etc/claw.json"))


@lru_cache
def load_config() -> dict:
    if not CONFIG_PATH.exists() or not CONFIG_PATH.is_file():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def inference_base_url() -> str:
    cfg = load_config()
    # The host running the sandbox exposes mlx-lm on this address by default;
    # the supplier can point this at any OpenAI-compatible endpoint (e.g. an
    # io.net-hosted GLM) via the worker's CLAW_INFERENCE_BASE_URL.
    return cfg.get("inference_base_url", "http://host.containers.internal:9000/v1")


def inference_api_key() -> str:
    """Bearer token for the inference endpoint. Empty / 'not-required' for a
    local unauthenticated server (mlx-lm)."""
    return load_config().get("inference_api_key", "")


def max_tokens() -> int:
    # Reasoning models (GLM-5.2) spend tokens thinking before the answer lands
    # in `content`; give enough headroom that the final answer is produced.
    try:
        return int(load_config().get("max_tokens", 2048))
    except (TypeError, ValueError):
        return 2048


def model_id() -> str:
    mid = load_config().get("model_id", "qwen")
    return mid if isinstance(mid, str) else "qwen"


def booking_id() -> str:
    return load_config().get("booking_id", "unknown")


def workload() -> str:
    return load_config().get("workload", "sandbox")


def state_dir() -> str | None:
    """Directory backed by a persistent volume (Hermes only). None = ephemeral."""
    return load_config().get("state_dir")
