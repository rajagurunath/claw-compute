"""Hermes persistent memory.

A deliberately tiny key/value + notes store on the volume mounted at
``state_dir`` (``/claw/state``). Because the worker backs that path with a
*named* Docker volume keyed by the agent's stable identity, whatever Hermes
writes here survives teardown and is remounted on the next booking — the
"carries state across bookings" property, demonstrated end to end.

For ephemeral workloads (sandbox / openclaw) there is no state dir and these
endpoints report ``persistent: false``.
"""

import json
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from agent_runtime.config import booking_id, state_dir, workload

router = APIRouter()

_MEMORY_FILE = "memory.json"


def _path() -> Path | None:
    sd = state_dir()
    return Path(sd) / _MEMORY_FILE if sd else None


def _empty() -> dict:
    return {"notes": [], "bookings": [], "turns": []}


def _load() -> dict:
    p = _path()
    if p is None or not p.exists():
        return _empty()
    try:
        data = json.loads(p.read_text())
        for k, v in _empty().items():
            data.setdefault(k, v)
        return data
    except (json.JSONDecodeError, OSError):
        return _empty()


def recent_turns(n: int = 8) -> list[dict]:
    """Last N chat turns ({role, content}) — the conversation the agent should
    keep in context, persisted so it survives across bookings."""
    return _load().get("turns", [])[-n:]


def append_turn(user_text: str, assistant_text: str) -> None:
    """Record one exchange so the agent remembers it later (this session and
    future bookings). Capped so the file stays small."""
    mem = _load()
    turns = mem.setdefault("turns", [])
    turns.append({"role": "user", "content": user_text})
    turns.append({"role": "assistant", "content": assistant_text})
    mem["turns"] = turns[-40:]
    _save(mem)


def _save(mem: dict) -> bool:
    p = _path()
    if p is None:
        return False
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(mem, indent=2))
        return True
    except OSError:
        # A read-only or mis-permissioned volume must never take the agent down.
        return False


class Note(BaseModel):
    text: str


@router.get("/v1/hermes/memory")
async def get_memory() -> dict:
    mem = _load()
    return {
        "workload": workload(),
        "persistent": state_dir() is not None,
        "notes": mem.get("notes", []),
        "prior_bookings": mem.get("bookings", []),
        "booking_id": booking_id(),
    }


@router.post("/v1/hermes/memory")
async def add_note(note: Note) -> dict:
    mem = _load()
    mem.setdefault("notes", []).append({"booking_id": booking_id(), "text": note.text})
    persisted = _save(mem)
    return {"persisted": persisted, "note_count": len(mem["notes"])}


def record_boot() -> None:
    """Append this booking to the agent's history on startup (Hermes only)."""
    if state_dir() is None:
        return
    mem = _load()
    bookings = mem.setdefault("bookings", [])
    if booking_id() not in bookings:
        bookings.append(booking_id())
        _save(mem)
