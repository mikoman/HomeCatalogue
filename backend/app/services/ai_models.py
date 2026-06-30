"""Fetch available models from Ollama and LM Studio servers."""

import time
import httpx


async def fetch_ollama_models(base_url: str) -> list[dict]:
    url = f"{base_url.rstrip('/')}/api/tags"
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url)
    response.raise_for_status()
    payload = response.json()
    return [
        {"id": m["name"], "name": m["name"]}
        for m in payload.get("models", [])
        if m.get("name")
    ]


async def fetch_lmstudio_models(base_url: str) -> list[dict]:
    url = f"{base_url.rstrip('/')}/models"
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url)
    response.raise_for_status()
    payload = response.json()
    models = []
    for entry in payload.get("data", []):
        model_id = entry.get("id") or entry.get("name")
        if model_id:
            models.append({"id": model_id, "name": model_id})
    return models


async def list_models(provider: str, base_url: str) -> tuple[list[dict], str | None]:
    try:
        if provider == "ollama":
            return await fetch_ollama_models(base_url), None
        if provider == "lmstudio":
            return await fetch_lmstudio_models(base_url), None
        return [], f"Unsupported provider: {provider}"
    except httpx.HTTPError as exc:
        return [], f"Could not reach server: {exc}"
    except Exception as exc:
        return [], str(exc)


async def test_connection(provider: str, base_url: str) -> dict:
    """Ping the provider server and report whether models are reachable."""
    start = time.monotonic()
    models, error = await list_models(provider, base_url)
    latency_ms = int((time.monotonic() - start) * 1000)
    if error:
        return {
            "ok": False,
            "message": error,
            "latency_ms": latency_ms,
            "model_count": 0,
        }
    if not models:
        return {
            "ok": False,
            "message": "Server responded but returned no models.",
            "latency_ms": latency_ms,
            "model_count": 0,
        }
    return {
        "ok": True,
        "message": f"Connected — {len(models)} model(s) available",
        "latency_ms": latency_ms,
        "model_count": len(models),
    }


async def test_detector(base_url: str) -> dict:
    """Ping the YOLO-World detector sidecar's /health endpoint."""
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
            "message": f"Could not reach detector: {exc}",
            "latency_ms": int((time.monotonic() - start) * 1000),
            "model_count": 0,
        }
    except Exception as exc:
        return {
            "ok": False,
            "message": str(exc),
            "latency_ms": int((time.monotonic() - start) * 1000),
            "model_count": 0,
        }
