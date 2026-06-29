"""AI Vision service — handles image analysis via OpenAI, Anthropic, or Ollama."""

import json
import base64
from pathlib import Path
from app.config import settings
from app.schemas.scan import ScanResult, AIItem, AIContainer


SYSTEM_PROMPT = """You are an expert home organization and inventory intelligence system. Your task is to analyze the provided image of a home environment, closet, room, or drawer, and extract a complete, granular inventory list.

Rules:
- Identify distinct physical objects. Do not group distinct items unless they are identical duplicates (e.g., "Can of Beans x3").
- Identify structural boundaries within the image to propose containers. If looking at a bookshelf, each shelf is a container. If looking at a wardrobe, drawers or hanging rails are containers.
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


async def process_image_with_ai(image_path: str, room_id: int) -> ScanResult:
    """Process an uploaded image through the configured AI vision model."""
    provider = settings.ai_provider.lower()

    if provider == "openai":
        return await _process_openai(image_path)
    elif provider == "anthropic":
        return await _process_anthropic(image_path)
    elif provider == "ollama":
        return await _process_ollama(image_path)
    elif provider == "omlx":
        return await _process_omlx(image_path)
    else:
        raise ValueError(f"Unsupported AI provider: {provider}")


def _encode_image(image_path: str) -> str:
    """Encode image to base64 for API transmission."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


async def _process_openai(image_path: str) -> ScanResult:
    """Process image using OpenAI GPT-4o with structured outputs."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    image_b64 = _encode_image(image_path)

    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                    {
                        "type": "text",
                        "text": "Analyze this image and return a JSON object with 'proposed_containers' and 'items' arrays. Follow the schema strictly.",
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


async def _process_anthropic(image_path: str) -> ScanResult:
    """Process image using Anthropic Claude with structured outputs."""
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    image_b64 = _encode_image(image_path)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
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
                        "text": "Analyze this image and return a JSON object with 'proposed_containers' and 'items' arrays. Follow the schema strictly.",
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


async def _process_ollama(image_path: str) -> ScanResult:
    """Process image using local Ollama with Llava."""
    import httpx

    image_b64 = _encode_image(image_path)
    base_url = settings.ollama_base_url.rstrip("/")

    response = await httpx.AsyncClient().post(
        f"{base_url}/api/chat",
        json={
            "model": settings.ollama_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": "Analyze this image and return a JSON object with 'proposed_containers' and 'items' arrays. Follow the schema strictly.",
                    "images": [image_b64],
                },
            ],
            "stream": False,
            "format": "json",
        },
        timeout=120.0,
    )
    response.raise_for_status()
    data = response.json()
    content = data.get("message", {}).get("content", "{}")
    return _parse_scan_result(content)


async def _process_omlx(image_path: str) -> ScanResult:
    """Process image using oMLX with LLaVA models (Apple Silicon)."""
    import subprocess
    import json
    import base64

    # Encode image to base64
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode("utf-8")

    # Build the prompt for oMLX
    prompt = f"""{SYSTEM_PROMPT}

Analyze this image and return a JSON object with 'proposed_containers' and 'items' arrays. Follow the schema strictly.

Image (base64): {image_b64}"""

    try:
        # Run oMLX model via subprocess
        # oMLX typically uses mlx-lm or similar Python API
        # This assumes oMLX CLI is available or uses Python API
        result = subprocess.run(
            [
                "python3", "-c",
                f"""
import sys
try:
    from mlx_vlm import load, generate
    model, processor = load("{settings.omlx_model}")
    response = generate(
        model,
        processor,
        prompt="{prompt[:2000]}",  # Truncate to avoid command line limits
        max_tokens=4096,
        verbose=False
    )
    print(response)
except ImportError:
    # Fallback: try mlx-lm
    from mlx_lm import load as mlx_load, generate as mlx_generate
    model, tokenizer = mlx_load("{settings.omlx_model}")
    # Note: mlx-lm doesn't support vision, so this is a fallback
    print("Error: mlx-lm does not support vision models. Please install mlx-vlm.")
    sys.exit(1)
"""
            ],
            capture_output=True,
            text=True,
            timeout=180,
        )

        if result.returncode != 0:
            raise RuntimeError(f"oMLX error: {result.stderr}")

        content = result.stdout.strip()
        return _parse_scan_result(content)

    except subprocess.TimeoutExpired:
        raise RuntimeError("oMLX processing timed out (180s limit)")
    except FileNotFoundError:
        raise RuntimeError("python3 not found. Ensure Python 3 is installed.")


def _parse_scan_result(content: str) -> ScanResult:
    """Parse and validate the JSON response from the AI model."""
    # Strip markdown code fences if present
    content = content.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        lines = lines[1:]  # Remove opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]  # Remove closing fence
        content = "\n".join(lines)

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise ValueError(f"Invalid JSON from AI model: {content[:200]}...")

    # Build result with proper typing
    containers = [
        AIContainer(name=c["name"], description=c.get("description", ""))
        for c in data.get("proposed_containers", [])
    ]
    items = [
        AIItem(
            name=i["name"],
            category=i.get("category"),
            tags=i.get("tags", []),
            suggested_container=i.get("suggested_container"),
            confidence_score=i.get("confidence_score", 1.0),
        )
        for i in data.get("items", [])
    ]

    return ScanResult(proposed_containers=containers, items=items)
