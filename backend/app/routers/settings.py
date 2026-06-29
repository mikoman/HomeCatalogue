"""AI settings router — runtime provider/model configuration."""

from fastapi import APIRouter, HTTPException, Query
from app.schemas.settings import (
    AISettingsRead,
    AISettingsUpdate,
    AIModelInfo,
    AIModelsResponse,
    AIConnectionTest,
)
from app.services.ai_settings_store import load_settings, save_settings, settings_for_api
from app.services.ai_models import list_models, test_connection
from app.runtime_env import running_in_docker

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/ai", response_model=AISettingsRead)
def get_ai_settings():
    return settings_for_api()


@router.put("/ai", response_model=AISettingsRead)
def update_ai_settings(data: AISettingsUpdate):
    provider = data.provider.lower()
    stored = load_settings()
    stored["provider"] = provider
    if provider == "ollama":
        stored["ollama_base_url"] = data.base_url.rstrip("/")
        stored["ollama_model"] = data.model
    else:
        stored["lmstudio_base_url"] = data.base_url.rstrip("/")
        stored["lmstudio_model"] = data.model
    save_settings(stored)
    return settings_for_api()


@router.get("/ai/models", response_model=AIModelsResponse)
async def get_ai_models(
    provider: str = Query(..., pattern="^(ollama|lmstudio)$"),
    base_url: str | None = Query(None),
):
    stored = load_settings()
    if base_url is None:
        base_url = (
            stored["ollama_base_url"]
            if provider == "ollama"
            else stored["lmstudio_base_url"]
        )
    base_url = base_url.rstrip("/")
    models, error = await list_models(provider, base_url)
    return AIModelsResponse(
        provider=provider,
        base_url=base_url,
        models=[AIModelInfo(**m) for m in models],
        error=error,
    )


@router.get("/ai/test", response_model=AIConnectionTest)
async def test_ai_connection(
    provider: str = Query(..., pattern="^(ollama|lmstudio)$"),
    base_url: str | None = Query(None),
):
    stored = load_settings()
    if base_url is None:
        base_url = (
            stored["ollama_base_url"]
            if provider == "ollama"
            else stored["lmstudio_base_url"]
        )
    base_url = base_url.rstrip("/")
    result = await test_connection(provider, base_url)
    return AIConnectionTest(
        provider=provider,
        base_url=base_url,
        running_in_docker=running_in_docker(),
        **result,
    )
