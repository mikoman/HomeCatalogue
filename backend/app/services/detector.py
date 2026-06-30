"""Client for the YOLO-World detector sidecar.

Degrades gracefully: if the detector is disabled in settings or the sidecar is
unreachable, returns [] so a scan still completes (items just get no boxes).
"""

import base64

import httpx

from app.services.ai_settings_store import get_detector_config


async def detect_boxes(image_bytes: bytes, classes: list[str]) -> list[dict]:
    """Detect `classes` in the image via the sidecar.

    Returns [{label, bbox: [x1,y1,x2,y2] normalized 0..1, score}], or [] when the
    detector is off/unreachable — the detector is never on the critical path.
    """
    cfg = get_detector_config()
    if not cfg or not classes:
        return []
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{cfg['base_url']}/detect",
                json={"image_b64": image_b64, "classes": classes},
            )
        resp.raise_for_status()
        return resp.json().get("detections", [])
    except (httpx.HTTPError, ValueError, KeyError):
        return []
