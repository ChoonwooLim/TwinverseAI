from __future__ import annotations

import json

import httpx
import pytest

from app.config import Settings
from app.interfaces import DependencyError, DependencyProtocolError
from app.translator import OllamaTranslator


def _transport(*, content: str, status_code: int = 200) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "qwen2.5:7b"}]})
        assert request.url.path == "/api/chat"
        body = json.loads(request.content)
        assert body["stream"] is False
        assert body["format"] == "json"
        return httpx.Response(
            status_code,
            json={"message": {"content": content}},
        )

    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_ollama_translator_accepts_only_exact_language_schema(
    settings: Settings,
) -> None:
    content = json.dumps({"translations": {"ja": "こんにちは", "en": "Hello"}})
    async with httpx.AsyncClient(
        base_url="http://ollama.invalid", transport=_transport(content=content)
    ) as client:
        translator = OllamaTranslator(settings, client=client)
        await translator.start()
        result = await translator.translate("안녕하세요", "ko", ["ja", "en"])

    assert result == {"ja": "こんにちは", "en": "Hello"}


@pytest.mark.asyncio
async def test_ollama_translator_rejects_extra_or_missing_keys(
    settings: Settings,
) -> None:
    content = json.dumps({"translations": {"ja": "こんにちは"}, "commentary": "extra"})
    async with httpx.AsyncClient(
        base_url="http://ollama.invalid", transport=_transport(content=content)
    ) as client:
        translator = OllamaTranslator(settings, client=client)
        with pytest.raises(DependencyProtocolError):
            await translator.translate("안녕하세요", "ko", ["ja"])


@pytest.mark.asyncio
async def test_ollama_upstream_failure_is_sanitized(settings: Settings) -> None:
    async with httpx.AsyncClient(
        base_url="http://ollama.invalid",
        transport=_transport(content="secret upstream body", status_code=500),
    ) as client:
        translator = OllamaTranslator(settings, client=client)
        with pytest.raises(DependencyError) as caught:
            await translator.translate("private transcript", "ko", ["ja"])

    assert str(caught.value) == "translation failed"
    assert "private transcript" not in str(caught.value)
