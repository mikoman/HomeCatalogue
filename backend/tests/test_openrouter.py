"""Check OpenRouter routing, credentials, model discovery, and scan results."""

import asyncio
import json

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.routers.settings import router
from app.routers.scan import _scan_error_message
from app.services import ai_settings_store as store, ai_vision, openrouter


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "SETTINGS_FILE", tmp_path / "settings.json")
    monkeypatch.setattr(settings, "ai_provider", "ollama")
    monkeypatch.setattr(settings, "openrouter_api_key", "test-only-secret")
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        yield client


def mock_http(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))


def model_entry(model_id, inputs=None, outputs=None, parameters=None):
    return {
        "id": model_id,
        "architecture": {"input_modalities": inputs or ["text", "image"], "output_modalities": outputs or ["text"]},
        "supported_parameters": parameters if parameters is not None else ["response_format", "structured_outputs"],
    }


def test_openrouter_save_and_local_restore_preserve_config_without_secrets(client):
    client.put("/api/settings/ai", json={"provider": "lmstudio", "base_url": "http://local/v1", "model": "local", "embedding_model": "embed"})
    response = client.put("/api/settings/ai", json={"provider": "openrouter", "base_url": "https://untrusted.invalid/v1", "model": "vision"})
    assert response.status_code == 200
    assert response.json()["provider"] == response.json()["effective_provider"] == "openrouter"
    assert response.json()["base_url"] == openrouter.OPENROUTER_BASE_URL
    assert response.json()["openrouter_configured"] is True
    assert store.get_effective_ai_config()["model"] == "vision"
    assert store.get_embedding_config() is None
    assert "test-only-secret" not in response.text + store.SETTINGS_FILE.read_text()
    assert "api_key" not in store.SETTINGS_FILE.read_text()
    assert "untrusted" not in store.SETTINGS_FILE.read_text()
    restored = client.put("/api/settings/ai", json={"provider": "lmstudio", "base_url": "http://local/v1", "model": "local"})
    assert restored.json()["openrouter_model"] == "vision"
    assert store.get_embedding_config()["model"] == "embed"


def test_environment_can_select_openrouter(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "openrouter")
    monkeypatch.setattr(settings, "openrouter_model", "environment-model")
    response = client.get("/api/settings/ai").json()
    assert response["provider"] == response["effective_provider"] == "openrouter"
    assert response["model"] == response["effective_model"] == "environment-model"


def test_missing_key_blocks_activation_without_changing_saved_provider(client, monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    response = client.put("/api/settings/ai", json={"provider": "openrouter", "base_url": "", "model": "vision"})
    assert response.status_code == 400
    assert store.get_effective_ai_config()["provider"] == "ollama"
    assert not store.SETTINGS_FILE.exists()
    result = client.get("/api/settings/ai/test?provider=openrouter").json()
    assert result["ok"] is False
    assert "OPENROUTER_API_KEY" in result["message"]


def test_model_list_filters_modalities_schema_support_and_batch_routes(client, monkeypatch):
    def handler(request):
        assert str(request.url) == f"{openrouter.OPENROUTER_BASE_URL}/models"
        assert "authorization" not in request.headers
        return httpx.Response(200, json={"data": [
            model_entry("vision"), model_entry("text", inputs=["text"]),
            model_entry("generator", outputs=["image", "text"]),
            model_entry("plain-json", parameters=["response_format"]),
            model_entry("vision:batch"), None, {},
        ]})
    mock_http(monkeypatch, handler)
    response = client.get("/api/settings/ai/models?provider=openrouter&base_url=https://untrusted.invalid").json()
    assert response["base_url"] == openrouter.OPENROUTER_BASE_URL
    assert response["models"] == [{"id": "vision", "name": "vision"}]


def test_connection_checks_credentials_without_paid_inference(client, monkeypatch):
    paths = []
    def handler(request):
        assert request.url.host == "openrouter.ai"
        paths.append(request.url.path)
        if request.url.path.endswith("/key"):
            assert request.headers["authorization"] == "Bearer test-only-secret"
            return httpx.Response(200, json={"data": {"label": "never expose this"}})
        return httpx.Response(200, json={"data": [model_entry("vision")]})
    mock_http(monkeypatch, handler)
    response = client.get("/api/settings/ai/test?provider=openrouter&base_url=https://untrusted.invalid")
    assert response.json()["ok"] is True
    assert paths == ["/api/v1/key", "/api/v1/models"]
    assert "never expose" not in response.text
    assert "inference was not tested" in response.json()["message"]


@pytest.mark.parametrize("status", [401, 402, 403, 404, 429, 500])
def test_provider_errors_do_not_expose_response_content(client, monkeypatch, status):
    mock_http(monkeypatch, lambda request: httpx.Response(status, json={"error": {"message": "test-only-secret"}}))
    result = client.get("/api/settings/ai/test?provider=openrouter").json()
    assert result["ok"] is False
    assert "test-only-secret" not in result["message"]
    with pytest.raises(openrouter.OpenRouterError) as error:
        asyncio.run(openrouter.complete({}))
    assert "test-only-secret" not in _scan_error_message(error.value)


def test_scan_dispatch_sends_image_and_strict_schema_then_normalizes_box(client, monkeypatch):
    store.save_settings({"provider": "openrouter", "openrouter_model": "vision", "box_source": "vlm"})
    monkeypatch.setattr(ai_vision, "_encode_image", lambda _: "image-data")
    def handler(request):
        assert str(request.url) == f"{openrouter.OPENROUTER_BASE_URL}/chat/completions"
        assert request.headers["authorization"] == "Bearer test-only-secret"
        payload = json.loads(request.content)
        assert payload["model"] == "vision"
        assert payload["provider"] == {"require_parameters": True, "data_collection": "deny"}
        assert payload["max_tokens"] == settings.scan_max_tokens
        content = payload["messages"][1]["content"]
        assert content[0]["type"] == "text"
        assert "0 to 1000" in content[0]["text"]
        assert content[1]["image_url"]["url"] == "data:image/jpeg;base64,image-data"
        schema = payload["response_format"]["json_schema"]
        assert schema["strict"] is True
        for array in schema["schema"]["properties"].values():
            assert set(array["items"]["required"]) == set(array["items"]["properties"])
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": '{"items":[{"name":"Mug","bbox":[100,200,400,800]}]}'}}]})
    mock_http(monkeypatch, handler)
    result = asyncio.run(ai_vision.process_image_with_ai("unused.jpg", 1))
    assert result.items[0].bbox == [0.1, 0.2, 0.4, 0.8]
    assert ai_vision.JSON_SCHEMA["properties"]["items"]["items"]["required"] == ["name"]


@pytest.mark.parametrize("response", [
    {"choices": []},
    {"choices": [{"message": {"content": None}}]},
    {"choices": [{"finish_reason": "length", "message": {"content": '{"items":[]}'}}]},
])
def test_unusable_or_truncated_completion_cannot_be_an_empty_success(client, monkeypatch, response):
    mock_http(monkeypatch, lambda request: httpx.Response(200, json=response))
    with pytest.raises(ValueError):
        asyncio.run(openrouter.complete({}))


def test_http_200_provider_error_is_reported_safely(client, monkeypatch):
    mock_http(monkeypatch, lambda request: httpx.Response(200, json={"error": {"code": 429, "message": "test-only-secret"}}))
    with pytest.raises(openrouter.OpenRouterError, match="request limit") as error:
        asyncio.run(openrouter.complete({}))
    assert "test-only-secret" not in str(error.value)
