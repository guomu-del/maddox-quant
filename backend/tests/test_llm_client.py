import pytest

from app.core.config import settings
from app.services.llm_client import chat_completion


@pytest.mark.asyncio
async def test_llm_client_raises_without_api_key(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "")
    with pytest.raises(ValueError, match="LLM_API_KEY"):
        await chat_completion([{"role": "user", "content": "hi"}])
