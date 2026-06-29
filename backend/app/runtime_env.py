"""Detect runtime environment (Docker vs local) and provider URL defaults."""

import os
from pathlib import Path

DOCKER_HOST = "host.docker.internal"

PROVIDER_URL_DEFAULTS = {
    "ollama": {
        "local": "http://localhost:11434",
        "docker": f"http://{DOCKER_HOST}:11434",
    },
    "lmstudio": {
        "local": "http://localhost:1234/v1",
        "docker": f"http://{DOCKER_HOST}:1234/v1",
    },
}


def running_in_docker() -> bool:
    if os.getenv("RUNNING_IN_DOCKER", "").lower() in ("1", "true", "yes"):
        return True
    return Path("/.dockerenv").exists()


def suggested_provider_urls(provider: str) -> dict[str, str]:
    urls = PROVIDER_URL_DEFAULTS.get(provider, {})
    return {
        "local": urls.get("local", ""),
        "docker": urls.get("docker", ""),
    }


def default_provider_url(provider: str) -> str:
    key = "docker" if running_in_docker() else "local"
    return PROVIDER_URL_DEFAULTS.get(provider, {}).get(key, "")
