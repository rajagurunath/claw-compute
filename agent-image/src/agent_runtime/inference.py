"""Chat inference for the agent.

Talks to whatever OpenAI-compatible endpoint the supplier configured
(`inference_base_url`) — local mlx-lm, or a hosted model like io.net's
GLM-5.2. Uses httpx directly (not the openai SDK) so non-standard fields such
as GLM's `reasoning_content` survive, and so we can guarantee the response
carries a non-empty `choices[0].message.content` — which is exactly what the
worker relays back to the consumer.
"""

import httpx

from agent_runtime.config import (
    inference_api_key,
    inference_base_url,
    max_tokens,
    model_id,
)


async def chat_completion(messages: list[dict], stream: bool = False) -> dict:
    url = inference_base_url().rstrip("/") + "/chat/completions"
    payload = {
        "model": model_id(),
        "messages": messages,
        "max_tokens": max_tokens(),
        "stream": False,
    }
    headers = {"content-type": "application/json"}
    key = inference_api_key()
    if key and key != "not-required":
        headers["Authorization"] = f"Bearer {key}"

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    # Reasoning models put their answer in `content` once they finish thinking;
    # if it came back empty (token budget spent reasoning), fall back to the
    # reasoning text so the consumer always gets a reply, never a blank.
    try:
        message = data["choices"][0]["message"]
        if not (message.get("content") or "").strip():
            reasoning = (message.get("reasoning_content") or "").strip()
            message["content"] = reasoning or "(the model returned no content)"
    except (KeyError, IndexError, TypeError):
        pass
    return data
