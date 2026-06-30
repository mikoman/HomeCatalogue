"""AI settings router — runtime provider/model configuration."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from app.config import settings as config
from app.database import SessionLocal
from app.models.item import Item
from app.models.container import Container
from app.models.scan_session import ScanSession
from app.models.room import Room
from app.models.house import House
from app.schemas.settings import (
    AISettingsRead,
    AISettingsUpdate,
    DetectorSettingsUpdate,
    AIModelInfo,
    AIModelsResponse,
    AIConnectionTest,
)
from app.services.ai_settings_store import load_settings, save_settings, settings_for_api
from app.services.ai_models import list_models, test_connection, test_detector
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
    if data.embedding_model is not None:
        stored[f"{provider}_embedding_model"] = data.embedding_model.strip()
    save_settings(stored)
    return settings_for_api()


@router.put("/detector", response_model=AISettingsRead)
def update_detector_settings(data: DetectorSettingsUpdate):
    stored = load_settings()
    stored["box_source"] = data.box_source
    stored["detector_base_url"] = data.base_url.rstrip("/")
    save_settings(stored)
    return settings_for_api()


@router.get("/detector/test", response_model=AIConnectionTest)
async def test_detector_connection(base_url: str | None = Query(None)):
    stored = load_settings()
    base_url = (base_url or stored.get("detector_base_url") or "").rstrip("/")
    result = await test_detector(base_url)
    return AIConnectionTest(
        provider="detector",
        base_url=base_url,
        running_in_docker=running_in_docker(),
        **result,
    )


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


@router.post("/reset")
def reset_all_data():
    """Wipe ALL catalogue data and uploaded images — a full factory reset.

    Deletes every house, room, container, item, scan session, and image file.
    Keeps AI provider settings (ai_settings.json) so the user doesn't have to
    reconfigure their model. Irreversible.
    """
    db = SessionLocal()
    try:
        # Child → parent so foreign keys stay satisfied regardless of enforcement.
        db.query(Item).delete()
        db.query(Container).delete()
        db.query(ScanSession).delete()
        db.query(Room).delete()
        db.query(House).delete()
        db.commit()
    finally:
        db.close()

    removed = 0
    upload_dir = Path(config.upload_dir)
    if upload_dir.exists():
        for f in upload_dir.iterdir():
            if f.is_file():
                f.unlink()
                removed += 1

    return {"status": "reset", "images_removed": removed}
