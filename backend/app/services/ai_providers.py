"""Provider endpoints and URL validation for configuration and requests."""

from urllib.parse import urlsplit, urlunsplit


LOCAL_PROVIDERS = ("ollama", "lmstudio", "omlx")
CLOUD_URLS = {
    "openrouter": "https://openrouter.ai/api/v1",
    "deepseek": "https://api.deepseek.com",
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com/v1",
}
PROVIDERS = (*LOCAL_PROVIDERS, *CLOUD_URLS)


def normalize_url(value: str) -> str:
    """Accept HTTP server addresses without credentials, queries, or fragments."""
    try:
        url = urlsplit(value.strip())
        if (
            url.scheme not in {"http", "https"} or not url.hostname
            or url.username is not None or url.password is not None
            or url.query or url.fragment or any(char.isspace() for char in value)
            or "\\" in value
        ):
            raise ValueError
        _ = url.port
    except ValueError:
        raise ValueError("Enter an HTTP or HTTPS server URL without credentials, a query, or a fragment.") from None
    return urlunsplit((url.scheme.lower(), url.netloc.lower(), url.path.rstrip("/"), "", ""))


def provider_url(provider: str, value: str) -> str:
    if provider not in PROVIDERS:
        raise ValueError("Select a supported provider.")
    return CLOUD_URLS[provider] if provider in CLOUD_URLS else normalize_url(value)
