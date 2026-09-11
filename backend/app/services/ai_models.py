"""Discover provider models and test credentials without image inference."""

import time
import httpx
from app.services import openrouter
from app.services.ai_providers import CLOUD_URLS, provider_url
from app.services.ai_settings_store import get_api_key


async def fetch_models(provider: str, base_url: str, api_key: str) -> list[dict]:
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    if provider == "anthropic":
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    endpoint = "/api/tags" if provider == "ollama" else "/models"
    params = {"limit": 1000} if provider == "anthropic" else {}
    models = {}
    async with httpx.AsyncClient(timeout=15.0) as client:
        for _ in range(10):
            response = await client.get(f"{base_url}{endpoint}", headers=headers, params=params)
            response.raise_for_status()
            payload = response.json()
            entries = payload.get("models" if provider == "ollama" else "data")
            if not isinstance(entries, list):
                raise ValueError("Invalid model list")
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                model_id = entry.get("name") if provider == "ollama" else entry.get("id")
                if isinstance(model_id, str) and model_id:
                    name = entry.get("display_name") or model_id
                    models[model_id] = {"id": model_id, "name": name if isinstance(name, str) else model_id}
            if provider != "anthropic" or not payload.get("has_more"):
                break
            cursor = payload.get("last_id")
            if not isinstance(cursor, str) or cursor == params.get("after_id"):
                raise ValueError("Invalid model cursor")
            params["after_id"] = cursor
        else:
            raise ValueError("Model list exceeded the page limit")
    return list(models.values())


async def list_models(provider: str, base_url: str, api_key: str | None = None) -> tuple[list[dict], str | None]:
    try:
        base_url = provider_url(provider, base_url)
        if provider == "openrouter":
            return await openrouter.fetch_models(), None
        key = get_api_key(provider, base_url) if api_key is None else api_key
        if provider in CLOUD_URLS and not key:
            return [], "Enter an API key before loading models."
        return await fetch_models(provider, base_url, key), None
    except openrouter.OpenRouterError as error:
        return [], str(error)
    except httpx.HTTPStatusError as error:
        if error.response.status_code in (401, 403):
            return [], "The server rejected the credentials. Check the API key and its permissions."
        return [], f"The server returned HTTP {error.response.status_code}. Check the server URL and service status."
    except httpx.HTTPError:
        return [], "Cannot connect to the server. Check the URL and the backend network connection."
    except (ValueError, TypeError, KeyError, AttributeError):
        return [], "The server returned an invalid model list. Check the provider and server URL."


async def test_connection(provider: str, base_url: str, api_key: str | None = None) -> dict:
    start = time.monotonic()
    error = None
    models = []
    if provider == "openrouter":
        try:
            await openrouter.check_credentials(api_key)
        except openrouter.OpenRouterError as failure:
            error = str(failure)
        except httpx.HTTPError:
            error = "Cannot connect to OpenRouter. Check the backend internet connection."
    if error is None:
        models, error = await list_models(provider, base_url, api_key)
    return {
        "ok": error is None,
        "message": error or (
            f"Connection accepted. {len(models)} models available. Model inference was not tested."
            if models else "The server responded but returned no models. Install or load a vision model, then refresh the list."
        ),
        "latency_ms": int((time.monotonic() - start) * 1000),
        "model_count": len(models),
    }


async def test_detector(base_url: str) -> dict:
    """Test the detector health endpoint."""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{base_url.rstrip('/')}/health")
        resp.raise_for_status()
        data = resp.json()
        latency_ms = int((time.monotonic() - start) * 1000)
        if data.get("ok"):
            return {
                "ok": True,
                "message": f"Connected — {data.get('model', 'detector')}",
                "latency_ms": latency_ms,
                "model_count": 1,
            }
        return {
            "ok": False,
            "message": "Sidecar responded but is not ready.",
            "latency_ms": latency_ms,
            "model_count": 0,
        }
    except httpx.HTTPError as exc:
        return {
            "ok": False,
            "message": "Cannot connect to the detector. Check its URL and start the detector server.",
            "latency_ms": int((time.monotonic() - start) * 1000),
            "model_count": 0,
        }
    except Exception as exc:
        return {
            "ok": False,
            "message": "The detector returned an invalid response. Check its server URL.",
            "latency_ms": int((time.monotonic() - start) * 1000),
            "model_count": 0,
        }
