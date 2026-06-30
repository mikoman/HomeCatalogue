"""Runtime AI provider settings persisted to disk (overrides env defaults for local providers)."""

import json
import os
from pathlib import Path
from app.config import settings
from app.runtime_env import default_provider_url, running_in_docker, suggested_provider_urls


def _settings_path() -> Path:
    explicit = os.getenv("AI_SETTINGS_FILE")
    if explicit:
        return Path(explicit)
    upload = Path(settings.upload_dir)
    if upload.is_absolute():
        return upload.parent / "ai_settings.json"
    return Path("./ai_settings.json")


SETTINGS_FILE = _settings_path()


def _defaults() -> dict:
    return {
        "provider": settings.ai_provider.lower()
        if settings.ai_provider.lower() in ("ollama", "lmstudio")
        else "ollama",
        "ollama_base_url": settings.ollama_base_url or default_provider_url("ollama"),
        "ollama_model": settings.ollama_model,
        "lmstudio_base_url": settings.lmstudio_base_url or default_provider_url("lmstudio"),
        "lmstudio_model": settings.lmstudio_model,
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
            data.update({k: v for k, v in stored.items() if v is not None})
        except (json.JSONDecodeError, OSError):
            pass
    return data


def save_settings(data: dict) -> dict:
    merged = _defaults()
    merged.update(data)
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    return merged


def get_effective_ai_config() -> dict:
    """Return provider, base_url, and model for the active scan configuration."""
    data = load_settings()
    provider = data["provider"].lower()
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
    if settings.ai_provider.lower() == "openai":
        return {
            "provider": "openai",
            "base_url": "",
            "model": settings.openai_model,
        }
    if settings.ai_provider.lower() == "anthropic":
        return {
            "provider": "anthropic",
            "base_url": "",
            "model": settings.anthropic_model,
        }
    if settings.ai_provider.lower() == "omlx":
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
    if provider == "ollama":
        base_url, model = data["ollama_base_url"], data["ollama_model"]
    else:
        base_url, model = data["lmstudio_base_url"], data["lmstudio_model"]
    return {
        "provider": provider,
        "base_url": base_url,
        "model": model,
        "embedding_model": data.get(f"{provider}_embedding_model", ""),
        "ollama_base_url": data["ollama_base_url"],
        "ollama_model": data["ollama_model"],
        "ollama_embedding_model": data.get("ollama_embedding_model", ""),
        "lmstudio_base_url": data["lmstudio_base_url"],
        "lmstudio_model": data["lmstudio_model"],
        "lmstudio_embedding_model": data.get("lmstudio_embedding_model", ""),
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
