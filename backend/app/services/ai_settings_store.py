"""Runtime AI provider settings persisted to disk (overrides env defaults for local providers)."""

import json
import os
import tempfile
from pathlib import Path
from app.config import settings
from app.runtime_env import default_provider_url, running_in_docker, suggested_provider_urls
from app.services.openrouter import OPENROUTER_BASE_URL


def _settings_path() -> Path:
    explicit = os.getenv("AI_SETTINGS_FILE")
    if explicit:
        return Path(explicit)
    upload = Path(settings.upload_dir)
    if upload.is_absolute():
        return upload.parent / "ai_settings.json"
    return Path("./ai_settings.json")


SETTINGS_FILE = _settings_path()
_PROVIDERS = {"ollama", "lmstudio", "openai", "anthropic", "omlx", "openrouter"}


def _defaults() -> dict:
    return {
        "provider": settings.ai_provider.lower()
        if settings.ai_provider.lower() in _PROVIDERS
        else "ollama",
        "ollama_base_url": settings.ollama_base_url or default_provider_url("ollama"),
        "ollama_model": settings.ollama_model,
        "lmstudio_base_url": settings.lmstudio_base_url or default_provider_url("lmstudio"),
        "lmstudio_model": settings.lmstudio_model,
        "openrouter_model": settings.openrouter_model,
        # Embedding models for semantic search (empty = keyword-only).
        "ollama_embedding_model": "",
        "lmstudio_embedding_model": "",
        # Bounding-box source: "off" | "yolo" (detector sidecar) | "vlm" (model grounding).
        "box_source": "off",
        "detector_base_url": settings.detector_base_url,
        "detector_enabled": False,  # legacy; migrated to box_source by get_box_source()
    }


def load_settings() -> dict:
    data = _defaults()
    if SETTINGS_FILE.exists():
        try:
            stored = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
            if isinstance(stored, dict):
                data.update({
                    key: value for key, value in stored.items()
                    if key in data and isinstance(value, type(data[key]))
                })
                if "box_source" not in stored and stored.get("detector_enabled") is True:
                    data["box_source"] = "yolo"
        except (json.JSONDecodeError, OSError):
            pass
    if data["provider"].lower() not in _PROVIDERS:
        data["provider"] = _defaults()["provider"]
    return data


def save_settings(data: dict) -> dict:
    merged = _defaults()
    merged.update(data)
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=SETTINGS_FILE.parent, delete=False) as temporary:
            temporary_path = Path(temporary.name)
            json.dump(merged, temporary, indent=2)
        os.replace(temporary_path, SETTINGS_FILE)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    return merged


def get_effective_ai_config() -> dict:
    """Return provider, base_url, and model for the active scan configuration."""
    data = load_settings()
    provider = data["provider"].lower()
    if provider == "openrouter":
        return {
            "provider": provider,
            "base_url": OPENROUTER_BASE_URL,
            "model": data["openrouter_model"],
        }
    if provider == "ollama":
        return {
            "provider": "ollama",
            "base_url": data["ollama_base_url"].rstrip("/"),
            "model": data["ollama_model"],
        }
    if provider == "lmstudio":
        return {
            "provider": "lmstudio",
            "base_url": data["lmstudio_base_url"].rstrip("/"),
            "model": data["lmstudio_model"],
        }
    # Env-only cloud / legacy providers when not configured via settings UI.
    if provider == "openai":
        return {
            "provider": "openai",
            "base_url": "",
            "model": settings.openai_model,
        }
    if provider == "anthropic":
        return {
            "provider": "anthropic",
            "base_url": "",
            "model": settings.anthropic_model,
        }
    if provider == "omlx":
        return {
            "provider": "omlx",
            "base_url": settings.omlx_base_url.rstrip("/"),
            "model": settings.omlx_model,
        }
    return {
        "provider": "ollama",
        "base_url": data["ollama_base_url"].rstrip("/"),
        "model": data["ollama_model"],
    }


def get_embedding_config() -> dict | None:
    """Embedding provider/url/model for semantic search, or None when disabled.

    Uses the same local server as scanning — only the model differs.
    """
    data = load_settings()
    provider = data["provider"].lower()
    if provider == "ollama":
        return {
            "provider": "ollama",
            "base_url": data["ollama_base_url"].rstrip("/"),
            "model": data.get("ollama_embedding_model", ""),
        }
    if provider == "lmstudio":
        return {
            "provider": "lmstudio",
            "base_url": data["lmstudio_base_url"].rstrip("/"),
            "model": data.get("lmstudio_embedding_model", ""),
        }
    return None


_VALID_BOX_SOURCES = ("off", "yolo", "vlm")


def get_box_source() -> str:
    """Active bounding-box mode: 'off' | 'yolo' | 'vlm'.

    Migrates the legacy detector_enabled bool: True → 'yolo', False → 'off'.
    """
    data = load_settings()
    bs = data.get("box_source")
    if bs in _VALID_BOX_SOURCES:
        return bs
    # Legacy fallback: detector_enabled True means the YOLO sidecar was on.
    return "yolo" if data.get("detector_enabled") else "off"


def get_detector_config() -> dict | None:
    """Detector base_url when box_source is 'yolo', else None (scans skip detection)."""
    if get_box_source() != "yolo":
        return None
    data = load_settings()
    url = (data.get("detector_base_url") or settings.detector_base_url).rstrip("/")
    return {"base_url": url}


def settings_for_api() -> dict:
    data = load_settings()
    provider = data["provider"].lower()
    effective = get_effective_ai_config()
    if provider not in {"ollama", "lmstudio", "openrouter"}:
        provider = "ollama"
    if provider == "ollama":
        base_url, model = data["ollama_base_url"], data["ollama_model"]
    elif provider == "lmstudio":
        base_url, model = data["lmstudio_base_url"], data["lmstudio_model"]
    else:
        base_url, model = OPENROUTER_BASE_URL, data["openrouter_model"]
    return {
        "provider": provider,
        "effective_provider": effective["provider"],
        "effective_model": effective["model"],
        "base_url": base_url,
        "model": model,
        "embedding_model": data.get(f"{provider}_embedding_model", ""),
        "ollama_base_url": data["ollama_base_url"],
        "ollama_model": data["ollama_model"],
        "ollama_embedding_model": data.get("ollama_embedding_model", ""),
        "lmstudio_base_url": data["lmstudio_base_url"],
        "lmstudio_model": data["lmstudio_model"],
        "lmstudio_embedding_model": data.get("lmstudio_embedding_model", ""),
        "openrouter_base_url": OPENROUTER_BASE_URL,
        "openrouter_model": data["openrouter_model"],
        "openrouter_configured": bool(settings.openrouter_api_key.strip()),
        "box_source": get_box_source(),
        "detector_enabled": get_box_source() == "yolo",  # legacy mirror for old UIs
        "detector_base_url": data.get("detector_base_url", settings.detector_base_url),
        "running_in_docker": running_in_docker(),
        "suggested_urls": suggested_provider_urls(provider),
        "suggested_urls_by_provider": {
            "ollama": suggested_provider_urls("ollama"),
            "lmstudio": suggested_provider_urls("lmstudio"),
        },
    }
