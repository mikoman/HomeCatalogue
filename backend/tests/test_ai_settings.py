"""Check provider precedence without real credentials or settings files."""

import json

import pytest

from app.config import settings
from app.schemas.settings import AISettingsRead, DetectorSettingsUpdate
from app.services import ai_settings_store as store
from app.routers.settings import update_detector_settings


@pytest.fixture
def settings_file(tmp_path, monkeypatch):
    path = tmp_path / "ai_settings.json"
    monkeypatch.setattr(store, "SETTINGS_FILE", path)
    return path


@pytest.mark.parametrize("provider,model_field", [
    ("openai", "openai_model"),
    ("anthropic", "anthropic_model"),
    ("omlx", "omlx_model"),
])
def test_environment_provider_is_effective_without_a_stored_choice(settings_file, monkeypatch, provider, model_field):
    monkeypatch.setattr(settings, "ai_provider", provider)
    monkeypatch.setattr(settings, model_field, "chosen-vision-model")
    config = store.get_effective_ai_config()
    assert config["provider"] == provider
    assert config["model"] == "chosen-vision-model"
    response = AISettingsRead(**store.settings_for_api())
    assert response.provider == "ollama"
    assert response.effective_provider == provider
    assert response.effective_model == "chosen-vision-model"
    assert not any("key" in key for key in response.model_dump())


def test_saving_a_local_provider_overrides_the_environment(settings_file, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "openai")
    store.save_settings({"provider": "lmstudio", "lmstudio_model": "local-vision"})
    config = store.get_effective_ai_config()
    assert config["provider"] == "lmstudio"
    assert config["model"] == "local-vision"


def test_detector_save_does_not_change_effective_provider(settings_file, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "openai")
    result = update_detector_settings(DetectorSettingsUpdate(box_source="off"))
    assert result["effective_provider"] == "openai"
    assert store.get_effective_ai_config()["provider"] == "openai"


@pytest.mark.parametrize("content", ["[]", "null", "invalid JSON", '{"provider": null, "ollama_model": 42}'])
def test_malformed_stored_settings_use_defaults(settings_file, monkeypatch, content):
    monkeypatch.setattr(settings, "ai_provider", "ollama")
    settings_file.write_text(content)
    config = store.get_effective_ai_config()
    assert config["provider"] == "ollama"
    assert isinstance(config["model"], str)


def test_settings_replace_failure_preserves_the_previous_file(settings_file, monkeypatch):
    original = '{"provider":"ollama","ollama_model":"previous-model"}'
    settings_file.write_text(original)

    def fail_replace(*args):
        raise OSError("Simulated disk failure")

    monkeypatch.setattr(store.os, "replace", fail_replace)
    with pytest.raises(OSError, match="Simulated disk failure"):
        store.save_settings({"provider": "lmstudio"})
    assert settings_file.read_text() == original
    assert list(settings_file.parent.iterdir()) == [settings_file]


def test_legacy_detector_choice_is_preserved(settings_file):
    settings_file.write_text(json.dumps({"detector_enabled": True}))
    assert store.get_box_source() == "yolo"
