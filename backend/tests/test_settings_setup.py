"""Test setup with temporary files and simulated provider responses."""

import asyncio
import json
import stat

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.routers.settings import router
from app.services import ai_settings_store as store, ai_vision, embeddings
from app.services.ai_providers import PROVIDERS, CLOUD_URLS, LOCAL_PROVIDERS


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "SETTINGS_FILE", tmp_path / "ai_settings.json")
    monkeypatch.setattr(settings, "ai_provider", "ollama")
    for provider in ("openai", "anthropic", "openrouter", "omlx"):
        monkeypatch.setattr(settings, f"{provider}_api_key", "")
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        yield client


def mock_http(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))


def payload(provider="lmstudio", **changes):
    return {"provider": provider, "base_url": "http://models.test/v1", "model": "vision-test", **changes}


@pytest.mark.parametrize("provider", PROVIDERS)
def test_save_provider_key_and_model_then_reload(client, provider):
    response = client.put("/api/settings/ai", json=payload(provider, api_key="test-only-key"))
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    result = client.get("/api/settings/ai").json()
    assert result["effective_provider"] == provider
    assert result["providers"][provider]["api_key_source"] == "saved"
    assert "test-only-key" not in json.dumps(result)
    assert "_credentials" not in result
    assert store.get_api_key(provider) == "test-only-key"
    assert store.get_effective_ai_config()["model"] == "vision-test"
    assert stat.S_IMODE(store.SETTINGS_FILE.stat().st_mode) == 0o600
    assert result["base_url"] == CLOUD_URLS.get(provider, "http://models.test/v1")
    changed = client.put("/api/settings/ai", json=payload(provider, model="new-model", api_key=""))
    assert changed.status_code == 200
    assert store.get_api_key(provider) == "test-only-key"


def test_save_inactive_profile_and_remove_key(client, monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "environment-test-key")
    response = client.put("/api/settings/ai", json=payload("openrouter", api_key="saved-test-key", activate=False))
    assert response.json()["effective_provider"] == "ollama"
    assert store.get_api_key("openrouter") == "saved-test-key"
    removed = client.put("/api/settings/ai", json=payload("openrouter", api_key_action="clear", activate=False))
    assert removed.status_code == 200
    assert store.get_api_key("openrouter") == ""
    assert removed.json()["providers"]["openrouter"]["environment_key_available"] is True
    restored = client.put("/api/settings/ai", json=payload("openrouter", api_key_action="environment"))
    assert restored.json()["effective_provider"] == "openrouter"
    assert store.get_api_key("openrouter") == "environment-test-key"
    assert "environment-test-key" not in store.SETTINGS_FILE.read_text()


@pytest.mark.parametrize("provider", PROVIDERS)
def test_connection_with_draft_key_does_not_save_or_generate(client, monkeypatch, provider):
    requests = []
    def handler(request):
        assert request.method == "GET"
        requests.append(request)
        if request.url.path.endswith("/key"):
            assert request.headers["authorization"] == "Bearer draft-key"
            return httpx.Response(200, json={"data": {}})
        if provider == "openrouter":
            assert "authorization" not in request.headers
            return httpx.Response(200, json={"data": []})
        if provider == "anthropic":
            assert request.headers["x-api-key"] == "draft-key"
            assert request.headers["anthropic-version"] == "2023-06-01"
        else:
            assert request.headers["authorization"] == "Bearer draft-key"
        return httpx.Response(200, json={"models" if provider == "ollama" else "data": [{"name" if provider == "ollama" else "id": "vision-test"}]})
    mock_http(monkeypatch, handler)
    response = client.post("/api/settings/ai/test", json=payload(provider, api_key="draft-key"))
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert requests
    assert "draft-key" not in response.text
    assert not store.SETTINGS_FILE.exists()


@pytest.mark.parametrize("provider", LOCAL_PROVIDERS)
def test_saved_key_stays_bound_to_local_endpoint(client, monkeypatch, provider):
    client.put("/api/settings/ai", json=payload(provider, api_key="bound-test-key"))
    def handler(request):
        assert request.url.host == "different.test"
        assert "authorization" not in request.headers
        return httpx.Response(200, json={"models" if provider == "ollama" else "data": []})
    mock_http(monkeypatch, handler)
    response = client.post("/api/settings/ai/models", json=payload(provider, base_url="http://different.test/v1"))
    assert response.status_code == 200
    assert store.get_api_key(provider) == "bound-test-key"
    client.put("/api/settings/ai", json=payload(provider, base_url="http://different.test/v1"))
    assert store.get_api_key(provider) == ""


@pytest.mark.parametrize("url", ["file:///tmp/example", "http://user:test-key@server/v1", "http://server?key=test-key", "http://server#test-key", "http://server:bad", "http://"])
def test_invalid_endpoint_is_rejected_without_echoing_input(client, url):
    response = client.put("/api/settings/ai", json=payload(base_url=url))
    assert response.status_code == 400
    assert "test-key" not in response.text
    assert not store.SETTINGS_FILE.exists()


@pytest.mark.parametrize("key", [{"secret": "test-key"}, "test-key\n", "test key", "test-key" * 600])
def test_invalid_credentials_never_appear_in_error_response(client, key):
    # A trailing newline is removed before validation, like a pasted key.
    if isinstance(key, str) and key.endswith("\n"):
        key = "test\nkey"
    response = client.post("/api/settings/ai/test", json=payload(api_key=key))
    assert response.status_code in (400, 422)
    assert "test-key" not in response.text
    if isinstance(response.json().get("detail"), list):
        assert all("input" not in error for error in response.json()["detail"])


def test_provider_error_body_is_not_returned(client, monkeypatch):
    mock_http(monkeypatch, lambda request: httpx.Response(401, json={"error": "draft-key"}))
    response = client.post("/api/settings/ai/test", json=payload(api_key="draft-key"))
    assert response.json()["ok"] is False
    assert "draft-key" not in response.text


def test_scan_limits_and_detector_do_not_replace_provider_or_key(client):
    client.put("/api/settings/ai", json=payload(api_key="test-only-key"))
    limits = {"scan_max_edge": 1920, "scan_max_tokens": 8192, "ollama_num_ctx": 16384}
    assert client.put("/api/settings/scan", json=limits).status_code == 200
    assert client.put("/api/settings/detector", json={"box_source": "yolo", "base_url": "http://detector.test:8077/"}).status_code == 200
    assert store.get_scan_config() == limits
    assert store.get_effective_ai_config()["provider"] == "lmstudio"
    assert store.get_api_key("lmstudio") == "test-only-key"
    assert store.get_detector_config() == {"base_url": "http://detector.test:8077"}
    assert client.put("/api/settings/scan", json={**limits, "scan_max_edge": 0}).status_code == 422
    assert client.put("/api/settings/detector", json={"box_source": "yolo", "base_url": ""}).status_code == 400
    assert store.get_scan_config() == limits


def test_disk_failure_does_not_replace_configuration_or_credential(client, monkeypatch):
    client.put("/api/settings/ai", json=payload(api_key="old-test-key"))
    original = store.SETTINGS_FILE.read_bytes()
    def fail(*args):
        raise OSError("private filesystem details")
    monkeypatch.setattr(store.os, "replace", fail)
    response = client.put("/api/settings/ai", json=payload("openrouter", api_key="new-test-key"))
    assert response.status_code == 500
    assert "private" not in response.text
    assert store.SETTINGS_FILE.read_bytes() == original


@pytest.mark.parametrize("provider", LOCAL_PROVIDERS)
def test_local_scan_uses_saved_key_model_and_output_limit(client, monkeypatch, provider):
    client.put("/api/settings/ai", json=payload(provider, api_key="scan-test-key"))
    client.put("/api/settings/scan", json={"scan_max_tokens": 512, "scan_max_edge": 960, "ollama_num_ctx": 4096})
    monkeypatch.setattr(ai_vision, "_encode_image", lambda _: "synthetic-image")
    def handler(request):
        body = json.loads(request.content)
        assert request.headers["authorization"] == "Bearer scan-test-key"
        assert request.url.host == "models.test"
        assert body["model"] == "vision-test"
        if provider == "ollama":
            assert body["options"]["num_predict"] == 512
            assert body["options"]["num_ctx"] == 4096
            return httpx.Response(200, json={"message": {"content": '{"items":[]}'}})
        assert body["max_tokens"] == 512
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"items":[]}'}}]})
    mock_http(monkeypatch, handler)
    result = asyncio.run(getattr(ai_vision, f"_process_{provider}")("synthetic.jpg", "system", "user"))
    assert result.items == []


def test_anthropic_discovery_reads_all_pages(client, monkeypatch):
    cursors = []
    def handler(request):
        cursors.append(request.url.params.get("after_id"))
        next_page = len(cursors) == 1
        return httpx.Response(200, json={"data": [{"id": "first" if next_page else "second", "display_name": "Vision"}], "last_id": "first", "has_more": next_page})
    mock_http(monkeypatch, handler)
    result = client.post("/api/settings/ai/models", json=payload("anthropic", api_key="test-key")).json()
    assert [entry["id"] for entry in result["models"]] == ["first", "second"]
    assert cursors == [None, "first"]


@pytest.mark.parametrize("provider", ["openai", "anthropic"])
def test_cloud_scan_uses_saved_model_key_and_limit(client, monkeypatch, provider):
    import sys
    from types import SimpleNamespace

    client.put("/api/settings/ai", json=payload(provider, api_key="saved-scan-key"))
    client.put("/api/settings/scan", json={"scan_max_tokens": 1024})
    monkeypatch.setattr(ai_vision, "_encode_image", lambda _: "synthetic-image")

    class Client:
        def __init__(self, **options):
            assert options["api_key"] == "saved-scan-key"
            assert options["base_url"].startswith(CLOUD_URLS[provider].removesuffix('/v1'))
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))
            self.messages = SimpleNamespace(create=self.create)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def create(self, **request):
            assert request["model"] == "vision-test"
            assert request["max_completion_tokens" if provider == "openai" else "max_tokens"] == 1024
            if provider == "openai":
                return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='{"items":[]}'))])
            return SimpleNamespace(content=[SimpleNamespace(type="tool_use", input={"items": []})])

    monkeypatch.setitem(sys.modules, provider, SimpleNamespace(**{"AsyncOpenAI" if provider == "openai" else "AsyncAnthropic": Client}))
    result = asyncio.run(getattr(ai_vision, f"_process_{provider}")("synthetic.jpg", "system", "user"))
    assert result.items == []


def test_active_provider_switch_does_not_redirect_a_started_local_request(client, monkeypatch):
    client.put("/api/settings/ai", json=payload("lmstudio", api_key="local-test-key"))
    def encode(_):
        store.update_settings(lambda data: data.update(provider="openrouter", openrouter_model="cloud-model"))
        return "synthetic-image"
    monkeypatch.setattr(ai_vision, "_encode_image", encode)
    def handler(request):
        assert request.url.host == "models.test"
        assert json.loads(request.content)["model"] == "vision-test"
        assert request.headers["authorization"] == "Bearer local-test-key"
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"items":[]}'}}]})
    mock_http(monkeypatch, handler)
    assert asyncio.run(ai_vision._process_lmstudio("synthetic.jpg", "system", "user")).items == []


@pytest.mark.parametrize("provider", LOCAL_PROVIDERS)
def test_saved_key_reaches_embedding_requests(client, monkeypatch, provider):
    client.put("/api/settings/ai", json=payload(provider, api_key="embedding-test-key", embedding_model="text-embedding"))
    def handler(request):
        assert request.headers["authorization"] == "Bearer embedding-test-key"
        assert json.loads(request.content)["model"] == "text-embedding"
        return httpx.Response(200, json={"embedding": [0.2, 0.8]} if provider == "ollama" else {"data": [{"embedding": [0.2, 0.8]}]})
    original = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    assert embeddings.embed_text("synthetic item") == [0.2, 0.8]
