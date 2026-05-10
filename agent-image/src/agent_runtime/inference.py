from openai import AsyncOpenAI

from agent_runtime.config import inference_base_url, model_id


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(base_url=inference_base_url(), api_key="not-required")


async def chat_completion(messages: list[dict], stream: bool = False):
    return await _client().chat.completions.create(
        model=model_id(), messages=messages, stream=stream
    )
