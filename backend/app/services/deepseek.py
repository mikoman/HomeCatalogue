"""Send DeepSeek requests with JSON output and safe error messages."""

import httpx

from app.services.ai_providers import CLOUD_URLS


# The legacy Flash IDs now use the current vision model.
VISION_MODELS = {"deepseek-flash", "deepseek-v4-flash", "deepseek-v4-flash-vision-exp"}


class DeepSeekError(RuntimeError):
    """A DeepSeek failure that the application can show to the user."""


class DeepSeekOutputError(ValueError):
    """An invalid completion that permits the existing inventory repair attempt."""


def _status_error(status: int) -> DeepSeekError:
    messages = {
        400: "DeepSeek rejected the request. Check the vision model and its settings.",
        401: "DeepSeek rejected the API key. Replace the key in Settings.",
        402: "DeepSeek needs credits. Check the account balance.",
        403: "DeepSeek denied the request. Check the account permissions.",
        429: "DeepSeek reached a request limit. Wait before you retry the scan.",
    }
    return DeepSeekError(messages.get(status, f"DeepSeek returned HTTP {status}. Check the model and service status."))


async def complete(payload: dict, api_key: str) -> str:
    """Send a scan to the official endpoint. Reject empty or incomplete output."""
    if not api_key:
        raise DeepSeekError("Enter a DeepSeek API key in Settings, or set DEEPSEEK_API_KEY on the backend.")
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{CLOUD_URLS['deepseek']}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
    except httpx.TimeoutException:
        raise DeepSeekError("DeepSeek did not respond in time. Retry the scan.") from None
    except httpx.HTTPError:
        raise DeepSeekError("Cannot connect to DeepSeek. Check the backend internet connection.") from None
    if response.status_code >= 400:
        raise _status_error(response.status_code)
    try:
        data = response.json()
    except ValueError:
        raise DeepSeekOutputError("DeepSeek returned an unreadable response. Retry the scan.") from None
    if isinstance(data, dict) and data.get("error"):
        error = data["error"]
        code = error.get("code") if isinstance(error, dict) else None
        raise _status_error(code if isinstance(code, int) else 502)
    try:
        choice = data["choices"][0]
        content = choice["message"]["content"]
        finish_reason = choice.get("finish_reason")
    except (KeyError, IndexError, TypeError, AttributeError):
        raise DeepSeekOutputError("DeepSeek returned no inventory text. Retry the scan.") from None
    if finish_reason == "length":
        raise DeepSeekOutputError("DeepSeek truncated the inventory. Increase its output limit in Settings or scan a smaller area.")
    if finish_reason != "stop":
        raise DeepSeekOutputError("DeepSeek did not complete the inventory. Retry the scan.")
    if not isinstance(content, str) or not content.strip():
        raise DeepSeekOutputError("DeepSeek returned no inventory text. Retry the scan.")
    return content
