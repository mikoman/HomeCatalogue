"""Persist runtime settings and credentials in one protected, atomic file."""

import json
import os
import tempfile
from pathlib import Path
from threading import RLock
from pydantic import ValidationError

from app.config import settings
from app.schemas.settings import DeepSeekSettings
from app.runtime_env import default_provider_url, running_in_docker, suggested_provider_urls
from app.services.ai_providers import CLOUD_URLS, LOCAL_PROVIDERS, PROVIDERS, provider_url


def _settings_path() -> Path:
    explicit = os.getenv("AI_SETTINGS_FILE")
    if explicit:
        return Path(explicit)
    upload = Path(settings.upload_dir)
    return upload.parent / "ai_settings.json" if upload.is_absolute() else Path("./ai_settings.json")


SETTINGS_FILE = _settings_path()
_settings_lock = RLock()
_SCAN_LIMITS = {"scan_max_tokens": (256, 32768), "ollama_num_ctx": (2048, 131072), "scan_max_edge": (256, 4096)}


def _defaults() -> dict:
    data = {
        "provider": settings.ai_provider.lower() if settings.ai_provider.lower() in PROVIDERS else "ollama",
        "box_source": "off",
        "detector_base_url": settings.detector_base_url,
        "detector_enabled": False,
        "_credentials": {},
        "deepseek": DeepSeekSettings().model_dump(),
        **{name: getattr(settings, name) for name in _SCAN_LIMITS},
    }
    for provider in PROVIDERS:
        data[f"{provider}_model"] = getattr(settings, f"{provider}_model")
        if provider in LOCAL_PROVIDERS:
            data[f"{provider}_base_url"] = getattr(settings, f"{provider}_base_url") or default_provider_url(provider)
            data[f"{provider}_embedding_model"] = ""
    return data


def load_settings() -> dict:
    data = _defaults()
    try:
        stored = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        if isinstance(stored, dict):
            data.update({key: value for key, value in stored.items() if key in data and type(value) is type(data[key])})
            if "box_source" not in stored and stored.get("detector_enabled") is True:
                data["box_source"] = "yolo"
    except (json.JSONDecodeError, OSError):
        pass
    if data["provider"].lower() not in PROVIDERS:
        data["provider"] = _defaults()["provider"]
    for name, (minimum, maximum) in _SCAN_LIMITS.items():
        if not minimum <= data[name] <= maximum:
            data[name] = getattr(settings, name)
    try:
        data["deepseek"] = DeepSeekSettings.model_validate(data["deepseek"]).model_dump()
    except ValidationError:
        data["deepseek"] = DeepSeekSettings().model_dump()
    return data


def save_settings(data: dict) -> dict:
    """Replace settings atomically. Only the file owner can read or write the file."""
    merged = _defaults()
    merged.update({key: value for key, value in data.items() if key in merged})
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=SETTINGS_FILE.parent, delete=False) as temporary:
            temporary_path = Path(temporary.name)
            os.chmod(temporary_path, 0o600)
            json.dump(merged, temporary, indent=2)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_path, SETTINGS_FILE)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    return merged


def update_settings(change) -> dict:
    """Apply one change without losing another request's settings in this process."""
    with _settings_lock:
        data = load_settings()
        change(data)
        return save_settings(data)


def get_provider_config(provider: str, data: dict | None = None) -> dict:
    data = data if data is not None else load_settings()
    return {
        "provider": provider,
        "base_url": CLOUD_URLS.get(provider, data.get(f"{provider}_base_url", "")).rstrip("/"),
        "model": data[f"{provider}_model"],
        **({"deepseek": data["deepseek"]} if provider == "deepseek" else {}),
    }


def get_effective_ai_config() -> dict:
    data = load_settings()
    return get_provider_config(data["provider"].lower(), data)


def _environment_key(provider: str) -> str:
    return getattr(settings, f"{provider}_api_key", "").strip()


def credential_info(provider: str, base_url: str | None = None, data: dict | None = None) -> tuple[str, str]:
    """Return a credential only when its saved endpoint matches the request endpoint."""
    data = data if data is not None else load_settings()
    configured_url = get_provider_config(provider, data)["base_url"]
    try:
        target = provider_url(provider, base_url if base_url is not None else configured_url)
        configured = provider_url(provider, configured_url)
    except ValueError:
        return "", "none"
    entry = data["_credentials"].get(provider)
    if isinstance(entry, dict):
        key = entry.get("key")
        if isinstance(key, str) and entry.get("base_url") == target:
            return key, "saved" if key else "none"
        return "", "none"
    # Environment credentials apply only to their original environment endpoint.
    environment_url = CLOUD_URLS.get(provider, getattr(settings, f"{provider}_base_url", ""))
    try:
        environment_matches = target == provider_url(provider, environment_url)
    except ValueError:
        environment_matches = False
    key = _environment_key(provider) if target == configured and environment_matches else ""
    return key, "environment" if key else "none"


def get_api_key(provider: str, base_url: str | None = None) -> str:
    return credential_info(provider, base_url)[0]


def resolve_request(data, stored: dict | None = None) -> tuple[str, str]:
    """Resolve a draft URL and key without saving the draft."""
    stored = stored if stored is not None else load_settings()
    provider = data.provider
    url = provider_url(provider, data.base_url if data.base_url is not None else get_provider_config(provider, stored)["base_url"])
    key = data.api_key.get_secret_value().strip() if data.api_key is not None else ""
    if any(ord(char) < 33 or ord(char) > 126 for char in key):
        raise ValueError("Enter an API key without spaces or control characters.")
    if data.api_key_action == "replace" or (data.api_key_action == "keep" and key):
        if not key:
            raise ValueError("Enter an API key to replace the current key.")
        return url, key
    if data.api_key_action == "clear":
        return url, ""
    if data.api_key_action == "environment":
        copy = {**stored, "_credentials": {key: value for key, value in stored["_credentials"].items() if key != provider}}
        return url, credential_info(provider, url, copy)[0]
    return url, credential_info(provider, url, stored)[0]


def apply_provider_settings(data, stored: dict) -> None:
    url, key = resolve_request(data, stored)
    if not data.model.strip():
        raise ValueError("Select a model before saving.")
    if data.activate and data.provider in CLOUD_URLS and not key:
        raise ValueError("Enter an API key before using this provider. You can save the provider without switching.")
    provider = data.provider
    if data.api_key_action == "environment":
        stored["_credentials"].pop(provider, None)
    elif data.api_key_action in {"replace", "clear"} or (data.api_key and data.api_key.get_secret_value().strip()):
        stored["_credentials"][provider] = {"base_url": url, "key": key}
    elif provider in LOCAL_PROVIDERS and url != get_provider_config(provider, stored)["base_url"]:
        # An endpoint change must not transfer a saved key to another server.
        stored["_credentials"][provider] = {"base_url": url, "key": key}
    if provider in LOCAL_PROVIDERS:
        stored[f"{provider}_base_url"] = url
        if data.embedding_model is not None:
            stored[f"{provider}_embedding_model"] = data.embedding_model.strip()
    stored[f"{provider}_model"] = data.model.strip()
    if provider == "deepseek" and data.deepseek is not None:
        stored["deepseek"] = data.deepseek.model_dump()
    if data.activate:
        stored["provider"] = provider


def get_scan_config() -> dict:
    data = load_settings()
    return {key: data[key] for key in _SCAN_LIMITS}


def get_embedding_config() -> dict | None:
    data = load_settings()
    provider = data["provider"].lower()
    if provider not in LOCAL_PROVIDERS:
        return None
    return {**get_provider_config(provider, data), "model": data.get(f"{provider}_embedding_model", "")}


def get_box_source() -> str:
    data = load_settings()
    source = data.get("box_source")
    return source if source in ("off", "yolo", "vlm") else ("yolo" if data.get("detector_enabled") else "off")


def get_detector_config() -> dict | None:
    if get_box_source() != "yolo":
        return None
    data = load_settings()
    return {"base_url": (data.get("detector_base_url") or settings.detector_base_url).rstrip("/")}


def settings_for_api() -> dict:
    """Build the public response from an allowlist. Never include credentials."""
    data = load_settings()
    provider = data["provider"].lower()
    effective = get_provider_config(provider, data)
    providers = {}
    for name in PROVIDERS:
        key, source = credential_info(name, data=data)
        config = get_provider_config(name, data)
        providers[name] = {
            "base_url": config["base_url"], "model": config["model"],
            "embedding_model": data.get(f"{name}_embedding_model", ""),
            "api_key_configured": bool(key), "api_key_source": source,
            "environment_key_available": bool(_environment_key(name)),
            **({"deepseek": config["deepseek"]} if name == "deepseek" else {}),
        }
    return {
        **effective,
        "providers": providers,
        "scan": {key: data[key] for key in _SCAN_LIMITS},
        "effective_provider": provider,
        "effective_model": effective["model"],
        "embedding_model": data.get(f"{provider}_embedding_model", ""),
        **{key: data[key] for key in (
            "ollama_base_url", "ollama_model", "ollama_embedding_model",
            "lmstudio_base_url", "lmstudio_model", "lmstudio_embedding_model", "openrouter_model",
        )},
        "openrouter_base_url": CLOUD_URLS["openrouter"],
        "openrouter_configured": providers["openrouter"]["api_key_configured"],
        "box_source": get_box_source(),
        "detector_enabled": get_box_source() == "yolo",
        "detector_base_url": data["detector_base_url"],
        "running_in_docker": running_in_docker(),
        "suggested_urls": suggested_provider_urls(provider),
        "suggested_urls_by_provider": {name: suggested_provider_urls(name) for name in LOCAL_PROVIDERS},
    }
