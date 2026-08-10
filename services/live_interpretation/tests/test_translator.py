from __future__ import annotations

import json

import httpx
import pytest

from app.config import Settings
from app.interfaces import DependencyError, DependencyProtocolError
from app.translator import OllamaTranslator


def _transport(
    *,
    content: str,
    status_code: int = 200,
    observed: list[dict[str, object]] | None = None,
    tool_calls: list[dict[str, object]] | None = None,
) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "qwen2.5:7b"}]})
        assert request.url.path == "/api/chat"
        body = json.loads(request.content)
        assert body["stream"] is False
        assert isinstance(body["format"], dict)
        assert "tools" not in body
        if observed is not None:
            observed.append(body)
        message: dict[str, object] = {"role": "assistant", "content": content}
        if tool_calls is not None:
            message["tool_calls"] = tool_calls
        return httpx.Response(
            status_code,
            json={
                "message": message,
                "done": True,
                "done_reason": "stop",
            },
        )

    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_ollama_translator_accepts_only_exact_language_schema(
    settings: Settings,
) -> None:
    content = json.dumps({"translations": {"ja": "こんにちは", "en": "Hello"}})
    observed: list[dict[str, object]] = []
    async with httpx.AsyncClient(
        base_url="http://ollama.invalid",
        transport=_transport(content=content, observed=observed),
    ) as client:
        translator = OllamaTranslator(settings, client=client)
        await translator.start()
        result = await translator.translate("안녕하세요", "ko", ["ja", "en"])

    assert result == {"ja": "こんにちは", "en": "Hello"}
    request = observed[0]
    schema = request["format"]
    assert schema == json.loads(request["messages"][1]["content"])["output_schema"]
    assert schema["additionalProperties"] is False
    assert schema["required"] == ["translations"]
    translations = schema["properties"]["translations"]
    assert translations["additionalProperties"] is False
    assert translations["required"] == ["ja", "en"]
    assert set(translations["properties"]) == {"ja", "en"}
    assert all(
        property_schema
        == {
            "type": "string",
            "minLength": 1,
            "maxLength": settings.max_transcript_chars,
        }
        for property_schema in translations["properties"].values()
    )


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
async def test_ollama_translator_rejects_live_bare_root_regression(
    settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    # qwen2.5:7b returned this shape with format="json" on Ollama 0.20.5.
    content = json.dumps(
        {"ja": "private translated value", "en": "another private value"}
    )
    async with httpx.AsyncClient(
        base_url="http://ollama.invalid", transport=_transport(content=content)
    ) as client:
        translator = OllamaTranslator(settings, client=client)
        with pytest.raises(DependencyProtocolError, match="invalid_root_schema"):
            await translator.translate("private transcript", "ko", ["ja", "en"])

    assert "private transcript" not in caplog.text
    assert "private translated value" not in caplog.text


@pytest.mark.asyncio
async def test_ollama_translator_rejects_tool_calls(settings: Settings) -> None:
    content = json.dumps({"translations": {"ja": "こんにちは"}})
    tool_calls = [{"function": {"name": "leak", "arguments": {}}}]
    async with httpx.AsyncClient(
        base_url="http://ollama.invalid",
        transport=_transport(content=content, tool_calls=tool_calls),
    ) as client:
        translator = OllamaTranslator(settings, client=client)
        with pytest.raises(DependencyProtocolError, match="tool_call_present"):
            await translator.translate("안녕하세요", "ko", ["ja"])


@pytest.mark.asyncio
async def test_ollama_upstream_failure_is_sanitized(
    settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    async with httpx.AsyncClient(
        base_url="http://ollama.invalid",
        transport=_transport(content="secret upstream body", status_code=500),
    ) as client:
        translator = OllamaTranslator(settings, client=client)
        with pytest.raises(DependencyError) as caught:
            await translator.translate("private transcript", "ko", ["ja"])

    assert str(caught.value) == "translation failed"
    assert "private transcript" not in str(caught.value)
    assert "private transcript" not in caplog.text
