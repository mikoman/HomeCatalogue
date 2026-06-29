"""AI Vision service — handles image analysis via OpenAI, Anthropic, or Ollama."""

import json
import base64
from pathlib import Path
from app.config import settings
from app.services.ai_settings_store import get_effective_ai_config
from app.schemas.scan import ScanResult, AIItem, AIContainer


SYSTEM_PROMPT = """You are an expert home organization and inventory intelligence system. Your task is to analyze the provided image of a home environment, closet, room, or drawer, and extract a complete, granular inventory list.

Rules:
- Identify distinct physical objects. Do not group distinct items unless they are identical duplicates (e.g., "Can of Beans x3").
- Identify structural boundaries within the image to propose containers. If looking at a bookshelf, each shelf is a container. If looking at a wardrobe, drawers or hanging rails are containers.
- Storage objects that are themselves containers (drawers, suitcases, bins, baskets, boxes, chests, wardrobes, shelving units, trunks, crates) belong in proposed_containers, not items — even when their contents are not visible or the container appears empty.
- Assign relevant categories and contextual tags to every item to facilitate rich keyword searching.
- Output your findings strictly in the requested JSON format. Do not include markdown formatting, conversational text, or explanations outside the JSON payload."""


JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "proposed_containers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["name"],
                "additionalProperties": False,
            },
        },
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "category": {"type": "string"},
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "suggested_container": {"type": "string"},
                    "confidence_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                },
                "required": ["name"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["items"],
    "additionalProperties": False,
}


DEFAULT_USER_PROMPT = (
    "Analyze this image and return a JSON object with 'proposed_containers' and 'items' arrays. "
    "Follow the schema strictly."
)


def _build_user_prompt(target_container: dict | None) -> str:
    if not target_container:
        return DEFAULT_USER_PROMPT
    name = target_container["name"]
    return (
        f"This photo shows the inside of the container \"{name}\". "
        f"Identify every item visible inside this container only. "
        f"Set suggested_container to \"{name}\" for each item. "
        f"Return a JSON object with 'proposed_containers' and 'items' arrays. "
        f"Keep proposed_containers empty unless you see a clearly distinct sub-container. "
        f"Follow the schema strictly."
    )


async def process_image_with_ai(
    image_path: str,
    room_id: int,
    existing_containers: list[dict] | None = None,
    target_container: dict | None = None,
) -> ScanResult:
    """Process an uploaded image through the configured AI vision model.

    `existing_containers` is an optional list of {"name", "description"} dicts
    describing the room's existing containers. When provided, the AI is told to
    reuse those (by setting suggested_container to the existing name) instead
    of re-proposing them in proposed_containers.

    `target_container` is set when the photo is a close-up of a specific
    container's contents — the prompt focuses on items inside that container.
    """
    provider = get_effective_ai_config()["provider"].lower()
    system_prompt = _build_system_prompt(existing_containers, target_container)
    user_prompt = _build_user_prompt(target_container)

    dispatch = {
        "openai": _process_openai,
        "anthropic": _process_anthropic,
        "ollama": _process_ollama,
        "lmstudio": _process_lmstudio,
        "omlx": _process_omlx,
    }.get(provider)
    if dispatch is None:
        raise ValueError(f"Unsupported AI provider: {provider}")

    try:
        return await dispatch(image_path, system_prompt, user_prompt)
    except ValueError:
        # Parse failed (bad/no JSON) — give the model one more shot with a
        # stricter nudge before the scan lands in the failed bin. Small local
        # models often need the reminder; the image is just re-encoded.
        repair_prompt = (
            user_prompt
            + "\n\nYour previous response was not valid JSON. Return ONLY the "
            "JSON object matching the schema — no prose, no markdown fences."
        )
        return await dispatch(image_path, system_prompt, repair_prompt)


def _build_system_prompt(
    existing_containers: list[dict] | None,
    target_container: dict | None = None,
) -> str:
    """Compose the base system prompt with existing-container context."""
    prompt = SYSTEM_PROMPT
    if target_container:
        name = target_container["name"]
        prompt = (
            prompt
            + "\n\n"
            + f"CONTAINER SCAN: The image is a photo taken inside the container \"{name}\". "
            f"Catalog only the items physically inside this container. "
            f"Do not propose \"{name}\" as a new container — it already exists. "
            f"Set suggested_container to \"{name}\" for every item you find. "
            f"Leave proposed_containers empty unless a clearly separate nested "
            f"container is visible inside \"{name}\"."
        )
    elif existing_containers:
        names = ", ".join(f"'{c['name']}'" for c in existing_containers)
        prompt = (
            prompt
            + "\n\n"
            + "The room already contains these containers: "
            + names
            + ". When an item belongs in one of these, set its suggested_container to that "
            "exact name and do NOT re-propose it in proposed_containers. Only add a container "
            "to proposed_containers if none of the existing ones fit."
        )
    return prompt


def _encode_image(image_path: str) -> str:
    """Encode image to base64 for API transmission."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


async def _process_openai(image_path: str, system_prompt: str, user_prompt: str) -> ScanResult:
    """Process image using OpenAI GPT-4o with structured outputs."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    image_b64 = _encode_image(image_path)

    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                    {
                        "type": "text",
                        "text": user_prompt,
                    },
                ],
            },
        ],
        response_format={"type": "json_schema", "json_schema": {"name": "scan_result", "schema": JSON_SCHEMA}},
        temperature=0.1,
        max_tokens=4096,
    )

    content = response.choices[0].message.content
    return _parse_scan_result(content)


async def _process_anthropic(image_path: str, system_prompt: str, user_prompt: str) -> ScanResult:
    """Process image using Anthropic Claude with structured outputs."""
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    image_b64 = _encode_image(image_path)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": user_prompt,
                    },
                ],
            },
        ],
        tools=[
            {
                "name": "scan_result",
                "description": "Scan result from image analysis",
                "input_schema": JSON_SCHEMA,
            }
        ],
        tool_choice={"type": "tool", "name": "scan_result"},
    )

    # Extract the tool use block
    for block in response.content:
        if block.type == "tool_use":
            return _parse_scan_result(json.dumps(block.input))

    raise ValueError("No tool use response from Anthropic")


async def _process_ollama(image_path: str, system_prompt: str, user_prompt: str) -> ScanResult:
    """Process image using a local Ollama vision model (e.g. llava, qwen3-vl)."""
    import httpx

    image_b64 = _encode_image(image_path)
    ai = get_effective_ai_config()
    base_url = ai["base_url"].rstrip("/")
    model = ai["model"]

    # Pass the JSON schema as `format` (Ollama structured outputs) so the model
    # returns the exact shape _parse_scan_result expects, not just any valid JSON.
    #
    # Timeout must cover not just one inference, but time spent queued behind
    # other scans: Ollama processes requests serially by default, so when the
    # UI fires several scans at once (multi-scan queue), a request may wait
    # N*(per-scan time) before Ollama starts it — and that wait counts against
    # this timeout. 600s comfortably covers a ~4-5 deep queue of slow 8B vision
    # scans plus this scan's own inference. Raise OLLAMA_NUM_PARALLEL to run
    # inference concurrently (VRAM permitting) if you need deeper queues.
    async with httpx.AsyncClient(timeout=600.0) as client:
        response = await client.post(
            f"{base_url}/api/chat",
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": user_prompt,
                        "images": [image_b64],
                    },
                ],
                "stream": False,
                "format": JSON_SCHEMA,
            },
        )
    response.raise_for_status()
    data = response.json()
    content = data.get("message", {}).get("content", "{}")
    return _parse_scan_result(content)


async def _process_openai_compatible(
    image_path: str,
    system_prompt: str,
    user_prompt: str,
    *,
    base_url: str,
    model: str,
    api_key: str = "",
) -> ScanResult:
    """Process image via an OpenAI-compatible API (LM Studio, oMLX, etc.)."""
    import httpx

    image_b64 = _encode_image(image_path)
    base_url = base_url.rstrip("/")
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    async with httpx.AsyncClient(timeout=600.0) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                            },
                            {
                                "type": "text",
                                "text": user_prompt,
                            },
                        ],
                    },
                ],
                "stream": False,
            },
        )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return _parse_scan_result(content)


async def _process_lmstudio(image_path: str, system_prompt: str, user_prompt: str) -> ScanResult:
    """Process image via LM Studio (OpenAI-compatible local server)."""
    ai = get_effective_ai_config()
    return await _process_openai_compatible(
        image_path,
        system_prompt,
        user_prompt,
        base_url=ai["base_url"],
        model=ai["model"],
    )


async def _process_omlx(image_path: str, system_prompt: str, user_prompt: str) -> ScanResult:
    """Process image via an oMLX server (OpenAI-compatible API, runs on the host).

    The backend runs in Docker, so OMLX_BASE_URL must point at the host
    (e.g. http://host.docker.internal:PORT/v1), not localhost.
    """
    return await _process_openai_compatible(
        image_path,
        system_prompt,
        user_prompt,
        base_url=settings.omlx_base_url,
        model=settings.omlx_model,
        api_key=settings.omlx_api_key,
    )


def _extract_json(content: str) -> dict:
    """Pull a JSON object out of a model response, tolerating fences and prose."""
    content = content.strip()
    # Strip a leading ```json / ``` fence and its closing fence.
    if content.startswith("```"):
        lines = content.split("\n")[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines)

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Fall back to the substring between the first { and last } — local models
    # often wrap the JSON in explanatory prose.
    start, end = content.find("{"), content.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(content[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Invalid JSON from AI model: {content[:200]}...")


def _parse_scan_result(content: str) -> ScanResult:
    """Parse and validate the JSON response from the AI model.

    Tolerant by design: skips entries missing a name rather than failing the
    whole scan — a partial inventory beats a hard failure in the bin.
    """
    data = _extract_json(content)

    containers = []
    for c in data.get("proposed_containers") or []:
        name = c.get("name")
        if not name:
            continue
        containers.append(AIContainer(name=name, description=c.get("description", "")))

    items = []
    for i in data.get("items") or []:
        name = i.get("name")
        if not name:
            continue
        items.append(
            AIItem(
                name=name,
                category=i.get("category"),
                tags=i.get("tags", []),
                suggested_container=i.get("suggested_container"),
                confidence_score=i.get("confidence_score", 1.0),
            )
        )

    return ScanResult(proposed_containers=containers, items=items)
