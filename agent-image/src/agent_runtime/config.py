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
    # The host running the sandbox exposes mlx-lm on this address by default.
    return cfg.get("inference_base_url", "http://host.containers.internal:9000/v1")


def model_id() -> str:
    return load_config().get("model_id", "qwen")


def booking_id() -> str:
    return load_config().get("booking_id", "unknown")
