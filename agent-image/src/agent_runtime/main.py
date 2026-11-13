from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent_runtime import health, inference, memory
from agent_runtime.config import workload

app = FastAPI(title="Claw Agent Runtime", version="0.1.0")
app.include_router(health.router)
app.include_router(memory.router)


@app.on_event("startup")
async def _record_boot() -> None:
    # Hermes: log this booking into the persistent history so continuity is
    # observable across sessions. No-op for ephemeral workloads. Never fatal —
    # a memory hiccup must not stop the agent from serving.
    try:
        memory.record_boot()
    except Exception:  # noqa: BLE001
        pass


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


def _hermes_system_prompt() -> dict | None:
    """For a Hermes agent, front-load what it remembers from past sessions so
    replies actually build on prior bookings."""
    if workload() != "hermes":
        return None
    mem = memory._load()
    notes = [n.get("text", "") for n in mem.get("notes", []) if n.get("text")]
    prior_sessions = len(mem.get("bookings", []))
    notes_block = ("\n".join(f"- {t}" for t in notes)) if notes else ""
    return {
        "role": "system",
        "content": (
            "You are a persistent Hermes agent on the Claw marketplace. You have "
            "durable long-term memory of your past conversations with this user, "
            "which survives across separate booking sessions. The messages that "
            "follow this one are your genuine memory of earlier exchanges — some "
            "may be from previous sessions, not the current one. Treat them as "
            "things you truly remember. Never say you lack memory of past "
            f"sessions; you have {prior_sessions} recorded so far."
            + (f"\nKey facts you've saved:\n{notes_block}" if notes_block else "")
            + "\nUse this memory to give continuous, personalized help. Be concise."
        ),
    }


@app.post("/v1/chat/completions")
async def chat(req: ChatRequest) -> dict:
    incoming = [m.model_dump() for m in req.messages]
    is_hermes = workload() == "hermes"

    # Hermes: the marketplace relays one message at a time, so rebuild context
    # from persistent memory — system prompt (with remembered notes) + recent
    # turns + the new message. This is what lets the agent hold a conversation
    # and carry it across bookings.
    if is_hermes:
        messages = []
        system = _hermes_system_prompt()
        if system:
            messages.append(system)
        messages.extend(memory.recent_turns())
        messages.extend(m for m in incoming if m.get("role") != "system")
    else:
        messages = incoming

    try:
        result = await inference.chat_completion(messages, stream=False)
    except Exception as e:
        raise HTTPException(502, f"inference upstream failed: {e}") from e

    if is_hermes:
        user_text = next(
            (m["content"] for m in reversed(incoming) if m.get("role") == "user"), ""
        )
        try:
            reply = result["choices"][0]["message"]["content"]
            memory.append_turn(user_text, reply)
        except (KeyError, IndexError, TypeError):
            pass
    return result
