"""Check DeepSeek settings and scan requests with simulated HTTP responses."""

import asyncio
import base64
import io
import json

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings, settings
from app.routers.scan import _scan_error_message
from app.routers.settings import router
from app.services import ai_settings_store as store, ai_vision, deepseek


DEFAULTS = {"image_detail": "original", "thinking": "disabled", "reasoning_effort": "high", "max_tokens": 8192}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "SETTINGS_FILE", tmp_path / "settings.json")
    monkeypatch.setattr(settings, "ai_provider", "ollama")
    monkeypatch.setattr(settings, "deepseek_api_key", "")
    monkeypatch.setattr(settings, "deepseek_model", "deepseek-flash")
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        yield client


def mock_http(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))


def completion(content='{"items":[]}', finish_reason="stop"):
    return {"choices": [{"finish_reason": finish_reason, "message": {"content": content, "reasoning_content": "unused reasoning"}}]}


def save(client, **changes):
    return client.put("/api/settings/ai", json={"provider": "deepseek", "model": "deepseek-flash", **changes})


def test_defaults_and_environment_configuration(client, monkeypatch):
    result = client.get("/api/settings/ai").json()
    assert result["providers"]["deepseek"]["deepseek"] == DEFAULTS
    assert result["providers"]["deepseek"]["model"] == "deepseek-flash"
    assert result["providers"]["deepseek"]["base_url"] == "https://api.deepseek.com"
    assert result["providers"]["deepseek"]["api_key_configured"] is False
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-flash")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "environment-test-key")
    configured = Settings(_env_file=None)
    assert configured.ai_provider == "deepseek"
    assert configured.deepseek_model == "deepseek-flash"
    assert configured.deepseek_api_key == "environment-test-key"
    monkeypatch.setattr(store, "settings", configured)
    result = client.get("/api/settings/ai").json()
    assert result["effective_provider"] == "deepseek"
    assert result["providers"]["deepseek"]["api_key_source"] == "environment"
    assert "environment-test-key" not in json.dumps(result)


def test_profile_options_survive_switches_and_shared_limit_updates(client):
    options = {"image_detail": "low", "thinking": "enabled", "reasoning_effort": "max", "max_tokens": 65536}
    result = save(client, deepseek=options, api_key="saved-test-key", activate=False)
    assert result.status_code == 200
    assert result.json()["effective_provider"] == "ollama"
    assert result.json()["providers"]["deepseek"]["deepseek"] == options
    assert save(client).json()["effective_provider"] == "deepseek"
    assert store.get_embedding_config() is None
    assert client.put("/api/settings/scan", json={"scan_max_tokens": 1024}).status_code == 200
    assert client.put("/api/settings/ai", json={"provider": "ollama", "model": "local-vision"}).status_code == 200
    restored = save(client).json()
    assert restored["providers"]["deepseek"]["deepseek"] == options
    assert restored["scan"]["scan_max_tokens"] == 1024
    assert restored["providers"]["ollama"]["model"] == "local-vision"
    assert store.get_api_key("deepseek") == "saved-test-key"
    assert "saved-test-key" not in json.dumps(restored)


@pytest.mark.parametrize("options", [
    {"image_detail": "invalid"}, {"thinking": True}, {"reasoning_effort": "medium"},
    {"max_tokens": 255}, {"max_tokens": 393217}, {"max_tokens": 8192.5},
])
def test_invalid_options_do_not_save_or_expose_keys(client, options):
    result = save(client, deepseek=options, api_key="private-test-key")
    assert result.status_code == 422
    assert "private-test-key" not in result.text
    assert not store.SETTINGS_FILE.exists()


@pytest.mark.parametrize("stored", [None, [], {"max_tokens": -1}, {"image_detail": "invalid"}])
def test_invalid_stored_options_use_defaults(client, stored):
    store.SETTINGS_FILE.write_text(json.dumps({"deepseek": stored}))
    assert client.get("/api/settings/ai").json()["providers"]["deepseek"]["deepseek"] == DEFAULTS


def test_model_discovery_uses_official_endpoint_and_only_lists_vision_models(client, monkeypatch):
    calls = []

    def handler(request):
        calls.append(request)
        assert request.method == "GET"
        assert str(request.url) == "https://api.deepseek.com/models"
        assert request.headers["authorization"] == "Bearer draft-test-key"
        return httpx.Response(200, json={"data": [
            {"id": "deepseek-flash"}, {"id": "deepseek-v4-pro"},
            {"id": "deepseek-v4-flash-vision-exp"}, {"id": "deepseek-v4-flash"},
            {"id": "deepseek-chat"}, None,
        ]})

    mock_http(monkeypatch, handler)
    payload = {"provider": "deepseek", "base_url": "https://untrusted.invalid", "api_key": "draft-test-key"}
    result = client.post("/api/settings/ai/models", json=payload)
    assert result.json()["error"] is None
    assert {model["id"] for model in result.json()["models"]} == deepseek.VISION_MODELS
    result = client.post("/api/settings/ai/test", json=payload)
    assert result.json()["ok"] is True
    assert result.json()["model_count"] == 3
    assert len(calls) == 2
    assert not store.SETTINGS_FILE.exists()
    assert "draft-test-key" not in result.text


def test_missing_key_blocks_activation_discovery_and_inference(client, monkeypatch):
    def unexpected_request(request):
        pytest.fail("A request without a key must not reach DeepSeek.")

    mock_http(monkeypatch, unexpected_request)
    assert save(client).status_code == 400
    assert client.post("/api/settings/ai/test", json={"provider": "deepseek"}).json()["ok"] is False
    assert client.get("/api/settings/ai/models?provider=deepseek").json()["error"]
    with pytest.raises(deepseek.DeepSeekError, match="DEEPSEEK_API_KEY"):
        asyncio.run(deepseek.complete({}, ""))
    assert not store.SETTINGS_FILE.exists()


def test_scan_sends_jpeg_json_example_and_defaults_then_normalizes_boxes(client, monkeypatch, tmp_path):
    assert save(client, api_key="scan-test-key").status_code == 200
    store.update_settings(lambda data: data.update(box_source="vlm", scan_max_edge=256))
    photo = tmp_path / "synthetic.png"
    Image.new("RGB", (800, 400), "white").save(photo)

    def handler(request):
        assert str(request.url) == "https://api.deepseek.com/chat/completions"
        assert request.headers["authorization"] == "Bearer scan-test-key"
        payload = json.loads(request.content)
        assert payload["model"] == "deepseek-flash"
        assert payload["response_format"] == {"type": "json_object"}
        assert payload["thinking"] == {"type": "disabled"}
        assert "reasoning_effort" not in payload
        assert payload["temperature"] == 0.1
        assert payload["max_tokens"] == 8192
        assert payload["stream"] is False
        assert "provider" not in payload
        system, user = payload["messages"]
        assert system["role"] == "system"
        assert "JSON schema:" in system["content"]
        assert "Example JSON" in system["content"]
        assert '"items": [' in system["content"]
        assert "Kitchen drawer" in system["content"]
        assert user["role"] == "user"
        assert "0 to 1000" in user["content"][0]["text"]
        image = user["content"][1]["image_url"]
        assert image["detail"] == "original"
        assert image["url"].startswith("data:image/jpeg;base64,")
        with Image.open(io.BytesIO(base64.b64decode(image["url"].split(",")[1]))) as decoded:
            assert decoded.format == "JPEG"
            assert decoded.size == (256, 128)
        return httpx.Response(200, json=completion('{"items":[{"name":"Mug","bbox":[100,200,400,800]}]}'))

    mock_http(monkeypatch, handler)
    result = asyncio.run(ai_vision.process_image_with_ai(str(photo), 1, target_container={"name": "Kitchen drawer"}))
    assert result.items[0].name == "Mug"
    assert result.items[0].bbox == [0.1, 0.2, 0.4, 0.8]


@pytest.mark.parametrize("detail", ["original", "low", "high", "auto"])
@pytest.mark.parametrize("effort", ["low", "high", "max"])
def test_scan_uses_saved_detail_effort_and_independent_output_limit(client, monkeypatch, detail, effort):
    options = {"image_detail": detail, "thinking": "enabled", "reasoning_effort": effort, "max_tokens": 65536}
    assert save(client, deepseek=options, api_key="saved-test-key", model="deepseek-v4-flash-vision-exp").status_code == 200
    monkeypatch.setattr(ai_vision, "_encode_image", lambda _: "synthetic")

    def handler(request):
        payload = json.loads(request.content)
        assert payload["model"] == "deepseek-v4-flash-vision-exp"
        assert payload["thinking"] == {"type": "enabled"}
        assert payload["reasoning_effort"] == effort
        assert payload["max_tokens"] == 65536
        assert payload["messages"][1]["content"][1]["image_url"]["detail"] == detail
        assert "temperature" not in payload
        assert "top_p" not in payload
        return httpx.Response(200, json=completion('{"items":[{"name":"Mug","bbox":[100,200,400,800]}]}'))

    mock_http(monkeypatch, handler)
    result = asyncio.run(ai_vision.process_image_with_ai("unused.jpg", 1))
    assert result.items[0].bbox is None


@pytest.mark.parametrize("response", [
    None, [], {}, {"choices": []}, {"choices": [None]},
    completion(None), completion(""), completion("   "),
    completion(finish_reason="length"), completion(finish_reason="content_filter"),
    completion(finish_reason="insufficient_system_resource"), completion(finish_reason="aborted"),
    completion(finish_reason="tool_calls"),
])
def test_incomplete_output_cannot_succeed(client, monkeypatch, response):
    mock_http(monkeypatch, lambda request: httpx.Response(200, content=json.dumps(response)))
    with pytest.raises(deepseek.DeepSeekOutputError):
        asyncio.run(deepseek.complete({}, "test-key"))


@pytest.mark.parametrize("invalid", ["", "not JSON", "{}", '{"items":null}', '```json\n{"items":[]}\n```'])
def test_invalid_inventory_gets_one_repair_attempt(client, monkeypatch, invalid):
    assert save(client, api_key="test-key").status_code == 200
    monkeypatch.setattr(ai_vision, "_encode_image", lambda _: "synthetic")
    prompts = []

    def handler(request):
        prompts.append(json.loads(request.content)["messages"][1]["content"][0]["text"])
        return httpx.Response(200, json=completion(invalid if len(prompts) == 1 else '{"items":[]}'))

    mock_http(monkeypatch, handler)
    assert asyncio.run(ai_vision.process_image_with_ai("unused.jpg", 1)).items == []
    assert len(prompts) == 2
    assert "previous response" in prompts[1]


def test_repeated_truncation_reports_the_deepseek_output_setting(client, monkeypatch):
    assert save(client, api_key="test-key").status_code == 200
    monkeypatch.setattr(ai_vision, "_encode_image", lambda _: "synthetic")
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=completion(finish_reason="length"))

    mock_http(monkeypatch, handler)
    with pytest.raises(deepseek.DeepSeekOutputError) as error:
        asyncio.run(ai_vision.process_image_with_ai("unused.jpg", 1))
    assert len(calls) == 2
    assert "Increase its output limit" in _scan_error_message(error.value)


@pytest.mark.parametrize("status", [400, 401, 402, 403, 429, 500, 503])
def test_http_errors_do_not_expose_provider_content(client, monkeypatch, status):
    mock_http(monkeypatch, lambda request: httpx.Response(status, json={"error": {"message": "private-test-key"}}))
    with pytest.raises(deepseek.DeepSeekError) as error:
        asyncio.run(deepseek.complete({}, "private-test-key"))
    assert "private-test-key" not in _scan_error_message(error.value)
    assert "DeepSeek" in _scan_error_message(error.value)


@pytest.mark.parametrize("failure", [httpx.ReadTimeout, httpx.ConnectError])
def test_network_errors_do_not_expose_request_details(client, monkeypatch, failure):
    def handler(request):
        raise failure("private-test-key", request=request)

    mock_http(monkeypatch, handler)
    with pytest.raises(deepseek.DeepSeekError) as error:
        asyncio.run(deepseek.complete({}, "private-test-key"))
    assert "private-test-key" not in _scan_error_message(error.value)


def test_success_status_with_error_payload_reports_a_safe_error(client, monkeypatch):
    mock_http(monkeypatch, lambda request: httpx.Response(200, json={"error": {"code": 429, "message": "private-test-key"}}))
    with pytest.raises(deepseek.DeepSeekError, match="request limit"):
        asyncio.run(deepseek.complete({}, "test-key"))
