"""Check asynchronous cloud requests without calling an AI service."""

import asyncio
import sys
import json
from types import SimpleNamespace

import pytest
import httpx

from app.services import ai_vision


@pytest.mark.parametrize("provider", ["openai", "anthropic"])
def test_cloud_analysis_yields_and_closes_its_client(monkeypatch, provider):
    events = []

    class AsyncClient:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))
            self.messages = SimpleNamespace(create=self.create)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            events.append("closed")

        async def create(self, **kwargs):
            await asyncio.sleep(0.01)
            events.append("response")
            if provider == "openai":
                return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='{"items":[{"name":"Mug"}]}'))])
            return SimpleNamespace(content=[SimpleNamespace(type="tool_use", input={"items": [{"name": "Mug"}]})])

    sdk = SimpleNamespace(**{"AsyncOpenAI" if provider == "openai" else "AsyncAnthropic": AsyncClient})
    monkeypatch.setitem(sys.modules, provider, sdk)
    monkeypatch.setattr(ai_vision, "_encode_image", lambda _: "photo")

    async def heartbeat():
        await asyncio.sleep(0)
        events.append("heartbeat")

    async def run():
        process = getattr(ai_vision, f"_process_{provider}")
        result, _ = await asyncio.gather(process("photo.jpg", "system", "user"), heartbeat())
        return result

    assert asyncio.run(run()).items[0].name == "Mug"
    assert events.index("heartbeat") < events.index("response")
    assert events[-1] == "closed"


def test_invalid_inventory_uses_the_existing_repair_attempt(monkeypatch):
    calls = []

    async def analyze(*args):
        calls.append(args)
        return ai_vision._parse_scan_result("{}" if len(calls) == 1 else '{"items":[]}')

    monkeypatch.setattr(ai_vision, "get_effective_ai_config", lambda: {"provider": "ollama"})
    monkeypatch.setattr(ai_vision, "get_box_source", lambda: "off")
    monkeypatch.setattr(ai_vision, "_process_ollama", analyze)
    result = asyncio.run(ai_vision.process_image_with_ai("photo.jpg", 1))
    assert result.items == []
    assert len(calls) == 2


def test_ollama_uses_bounded_context_and_rejects_truncated_json(monkeypatch):
    monkeypatch.setattr(ai_vision, "_encode_image", lambda _: "photo")
    monkeypatch.setattr(ai_vision, "get_effective_ai_config", lambda: {"base_url": "http://ollama", "model": "qwen3.5:9b"})

    def handler(request):
        body = json.loads(request.content)
        assert body["think"] is False
        assert body["options"]["num_ctx"] == ai_vision.settings.ollama_num_ctx
        assert body["options"]["num_predict"] == ai_vision.settings.scan_max_tokens
        assert body["format"]["required"] == ["items"]
        return httpx.Response(200, json={"done_reason": "length", "message": {"content": '{"items":[]}'}})

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    with pytest.raises(ValueError, match="truncated"):
        asyncio.run(ai_vision._process_ollama("photo.jpg", "system", "user"))
