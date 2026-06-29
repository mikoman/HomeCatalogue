"""Local text embeddings for semantic search — reuses the configured AI server.

Returns None whenever embeddings aren't available (no embedding model set,
server down, unsupported provider) so callers transparently fall back to
keyword search. Semantic search is a pure enhancement, never a hard dependency.
"""

import math
import httpx

from app.services.ai_settings_store import get_embedding_config


def embed_text(text: str) -> list[float] | None:
    """Embed a short text via the active local provider, or None if unavailable."""
    cfg = get_embedding_config()
    if not cfg or not cfg.get("model") or not text.strip():
        return None
    base_url = cfg["base_url"].rstrip("/")
    model = cfg["model"]
    try:
        if cfg["provider"] == "ollama":
            with httpx.Client(timeout=30.0) as client:
                r = client.post(f"{base_url}/api/embeddings", json={"model": model, "prompt": text})
            r.raise_for_status()
            return r.json().get("embedding") or None
        # OpenAI-compatible (LM Studio): base_url already includes /v1
        with httpx.Client(timeout=30.0) as client:
            r = client.post(f"{base_url}/embeddings", json={"model": model, "input": text})
        r.raise_for_status()
        data = r.json().get("data") or []
        return data[0]["embedding"] if data else None
    except Exception:
        return None


def cosine(a, b) -> float:
    """Cosine similarity. 0.0 for empty/mismatched vectors (e.g. after a model swap)."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def embed_source(item) -> str:
    """The text we embed for an item: name + category + tags."""
    parts = [item.name or "", item.category or ""]
    if item.tags:
        parts.append(" ".join(item.tags))
    return " ".join(p for p in parts if p).strip()
