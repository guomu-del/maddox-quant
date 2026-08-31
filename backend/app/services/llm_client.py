import asyncio
from typing import Any

import httpx

from app.core.config import settings

MAX_RETRIES = 3
TIMEOUT_SECONDS = 60


async def chat_completion(
    messages: list[dict[str, str]],
    json_mode: bool = True,
) -> str:
    if not settings.llm_api_key:
        raise ValueError("LLM_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": settings.llm_model,
        "messages": messages,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                response = await client.post(
                    f"{settings.llm_api_base.rstrip('/')}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
        except Exception as exc:
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(1 * (attempt + 1))

    raise RuntimeError(f"LLM request failed after {MAX_RETRIES} retries: {last_error}")
