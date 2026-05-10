from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent_runtime import health, inference

app = FastAPI(title="Claw Agent Runtime", version="0.1.0")
app.include_router(health.router)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


@app.post("/v1/chat/completions")
async def chat(req: ChatRequest) -> dict:
    try:
        result = await inference.chat_completion(
            [m.model_dump() for m in req.messages], stream=False
        )
    except Exception as e:
        raise HTTPException(502, f"inference upstream failed: {e}") from e
    return result.model_dump()
