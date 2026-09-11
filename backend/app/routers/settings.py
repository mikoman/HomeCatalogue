"""Configure inference providers, credentials, scan limits, and detection."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from app.config import settings as config
from app.database import SessionLocal
from app.models.item import Item
from app.models.container import Container
from app.models.scan_session import ScanSession
from app.models.room import Room
from app.models.house import House
from app.schemas.settings import (
    AISettingsRead, AISettingsUpdate, AIProviderRequest, ScanSettings, Provider,
    DetectorSettingsUpdate, AIModelInfo, AIModelsResponse, AIConnectionTest,
)
from app.services.ai_settings_store import (
    load_settings, update_settings, settings_for_api, apply_provider_settings, resolve_request,
)
from app.services.ai_models import list_models, test_connection, test_detector
from app.services.ai_providers import normalize_url
from app.runtime_env import running_in_docker


class SettingsRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def safe_handler(request):
            try:
                response = await handler(request)
            except RequestValidationError as error:
                # Validation responses must not echo a request that contains an API key.
                response = JSONResponse(status_code=422, content={
                    "detail": [{"loc": entry["loc"], "msg": entry["msg"], "type": entry["type"]} for entry in error.errors()],
                })
            response.headers["Cache-Control"] = "no-store"
            return response
        return safe_handler


router = APIRouter(prefix="/api/settings", tags=["settings"], route_class=SettingsRoute)


def _save(change):
    try:
        update_settings(change)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None
    except OSError:
        raise HTTPException(status_code=500, detail="Cannot save settings. Check the backend storage permissions and free space.") from None
    return settings_for_api()


@router.get("/ai", response_model=AISettingsRead)
def get_ai_settings():
    return settings_for_api()


@router.put("/ai", response_model=AISettingsRead)
def update_ai_settings(data: AISettingsUpdate):
    return _save(lambda stored: apply_provider_settings(data, stored))


@router.put("/scan", response_model=AISettingsRead)
def update_scan_settings(data: ScanSettings):
    return _save(lambda stored: stored.update(data.model_dump()))


@router.put("/detector", response_model=AISettingsRead)
def update_detector_settings(data: DetectorSettingsUpdate):
    def change(stored):
        url = normalize_url(data.base_url) if data.base_url.strip() else ""
        if data.box_source == "yolo" and not url:
            raise ValueError("Enter the detector URL before enabling detector boxes.")
        stored.update(box_source=data.box_source, detector_base_url=url)
    return _save(change)


@router.get("/detector/test", response_model=AIConnectionTest)
async def test_detector_connection(base_url: str | None = Query(None)):
    try:
        url = normalize_url(base_url if base_url is not None else load_settings()["detector_base_url"])
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None
    result = await test_detector(url)
    return AIConnectionTest(provider="detector", base_url=url, running_in_docker=running_in_docker(), **result)


def _connection(data: AIProviderRequest):
    try:
        return resolve_request(data)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None


@router.post("/ai/models", response_model=AIModelsResponse)
async def preview_ai_models(data: AIProviderRequest):
    url, key = _connection(data)
    models, error = await list_models(data.provider, url, key)
    return AIModelsResponse(provider=data.provider, base_url=url, models=[AIModelInfo(**model) for model in models], error=error)


@router.post("/ai/test", response_model=AIConnectionTest)
async def preview_ai_connection(data: AIProviderRequest):
    url, key = _connection(data)
    result = await test_connection(data.provider, url, key)
    return AIConnectionTest(provider=data.provider, base_url=url, running_in_docker=running_in_docker(), **result)


@router.get("/ai/models", response_model=AIModelsResponse)
async def get_ai_models(provider: Provider = Query(...), base_url: str | None = Query(None)):
    return await preview_ai_models(AIProviderRequest(provider=provider, base_url=base_url))


@router.get("/ai/test", response_model=AIConnectionTest)
async def test_ai_connection(provider: Provider = Query(...), base_url: str | None = Query(None)):
    return await preview_ai_connection(AIProviderRequest(provider=provider, base_url=base_url))


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
