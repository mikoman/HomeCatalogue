"""OpenRouter requests with backend credentials and safe error messages."""

import httpx

from app.services.ai_providers import CLOUD_URLS


OPENROUTER_BASE_URL = CLOUD_URLS["openrouter"]


class OpenRouterError(RuntimeError):
    """An OpenRouter failure that can be shown to the user."""


def _headers(api_key: str | None = None) -> dict[str, str]:
    from app.services.ai_settings_store import get_api_key

    key = get_api_key("openrouter") if api_key is None else api_key
    if not key:
        raise OpenRouterError("Enter an OpenRouter API key in Settings, or set OPENROUTER_API_KEY on the backend.")
    return {"Authorization": f"Bearer {key}", "X-OpenRouter-Title": "Home Catalogue"}


def _status_error(status: int) -> OpenRouterError:
    messages = {
        401: "OpenRouter rejected the API key. Replace the key in Settings.",
        402: "OpenRouter needs credits. Check the account balance and spending limit.",
        403: "OpenRouter denied this request. Check the account permissions and provider policies.",
        404: "OpenRouter could not find a compatible endpoint. Choose an image model with structured outputs.",
        429: "OpenRouter reached a request limit. Wait before retrying the scan.",
    }
    return OpenRouterError(messages.get(status, f"OpenRouter returned HTTP {status}. Check the selected model and service status."))


def _payload(response: httpx.Response) -> dict:
    if response.status_code >= 400:
        raise _status_error(response.status_code)
    try:
        data = response.json()
    except ValueError:
        raise OpenRouterError("OpenRouter returned an unreadable response. Retry the request.") from None
    if not isinstance(data, dict):
        raise OpenRouterError("OpenRouter returned an unexpected response. Retry the request.")
    if data.get("error"):
        error = data["error"]
        code = error.get("code") if isinstance(error, dict) else None
        raise _status_error(code if isinstance(code, int) else 502)
    return data


async def fetch_models() -> list[dict]:
    """List image models that advertise structured text output. No key is needed."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{OPENROUTER_BASE_URL}/models")
    data = _payload(response)
    entries = data.get("data")
    if not isinstance(entries, list):
        raise OpenRouterError("OpenRouter returned an invalid model list.")
    models = []
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
            continue
        architecture = entry.get("architecture") or {}
        parameters = entry.get("supported_parameters") or []
        if not isinstance(architecture, dict) or not isinstance(parameters, list):
            continue
        if (
            "image" in (architecture.get("input_modalities") or [])
            and architecture.get("output_modalities") == ["text"]
            and "structured_outputs" in parameters
            and "response_format" in parameters
            and not entry["id"].endswith(":batch")
        ):
            models.append({"id": entry["id"], "name": entry.get("name") or entry["id"]})
    return sorted(models, key=lambda model: model["name"].casefold())


async def check_credentials(api_key: str | None = None) -> None:
    """Check the key without sending an image or generating paid output."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{OPENROUTER_BASE_URL}/key", headers=_headers(api_key))
    data = _payload(response).get("data")
    if not isinstance(data, dict):
        raise OpenRouterError("OpenRouter returned an invalid credential response.")


async def complete(payload: dict) -> str:
    """Send one image request. Only the official endpoint receives the key."""
    headers = _headers()
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions", headers=headers, json=payload,
            )
    except httpx.TimeoutException:
        raise OpenRouterError("OpenRouter did not respond in time. Retry the scan.") from None
    except httpx.HTTPError:
        raise OpenRouterError("Cannot connect to OpenRouter. Check the backend internet connection.") from None
    data = _payload(response)
    try:
        choice = data["choices"][0]
        content = choice["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise ValueError("OpenRouter returned no inventory text.") from None
    if choice.get("finish_reason") == "length":
        raise ValueError("OpenRouter truncated the inventory. Increase SCAN_MAX_TOKENS or scan a smaller area.")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("OpenRouter returned no inventory text.")
    return content
