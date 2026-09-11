"""YOLOE and YOLO-World detection with text prompts and normalized boxes.

Run the sidecar on the host to use CUDA. CPU is the portable default.
"""

import base64
import io
import os
import threading

import torch
from fastapi import FastAPI
from pydantic import BaseModel, Field
from PIL import Image
from ultralytics import YOLOE, YOLOWorld

MODEL_NAME = os.getenv("DETECTOR_MODEL", "yoloe-26s-seg.pt")
DEFAULT_CONF = float(os.getenv("DETECTOR_CONF", "0.25"))
IMAGE_SIZE = int(os.getenv("DETECTOR_IMGSZ", "960"))
IS_YOLOE = os.path.basename(MODEL_NAME).lower().startswith("yoloe")
if IS_YOLOE and "-pf" in MODEL_NAME.lower():
    raise ValueError("Use text-prompt YOLOE weights. Prompt-free weights do not accept item labels.")


def _auto_device() -> str:
    """Pick a reliable device. CUDA works for YOLO-World; Apple MPS does NOT — its
    CLIP text encoder errors on set_classes ("Placeholder storage ... on MPS"), so
    we use CPU on Mac (fast enough for one image). Override with DETECTOR_DEVICE.
    """
    if torch.cuda.is_available():
        return "0"
    return "cpu"


DEVICE = os.getenv("DETECTOR_DEVICE") or _auto_device()

model = YOLOE(MODEL_NAME) if IS_YOLOE else YOLOWorld(MODEL_NAME)
# set_classes mutates the model in place, so serialize concurrent scans.
_lock = threading.Lock()


def _set_classes(classes: list[str]) -> None:
    if IS_YOLOE:
        model.set_classes(classes, model.get_text_pe(classes))
    else:
        model.set_classes(classes)

# Warm the open-vocab text encoder at boot (it downloads on the first set_classes),
# so the first real scan isn't slow. Best-effort — never block startup on it.
try:
    _set_classes(["object"])
except Exception:  # noqa: BLE001
    pass

app = FastAPI(title="Home Catalogue detector")


class DetectRequest(BaseModel):
    image_b64: str
    classes: list[str]
    conf: float | None = Field(default=None, ge=0, le=1)


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME, "device": DEVICE, "family": "yoloe" if IS_YOLOE else "yolo-world", "imgsz": IMAGE_SIZE}


@app.post("/detect")
def detect(req: DetectRequest):
    """Detect req.classes in the image; return boxes normalized to 0..1."""
    if not req.classes:
        return {"detections": []}
    img = Image.open(io.BytesIO(base64.b64decode(req.image_b64))).convert("RGB")
    with _lock:
        _set_classes(req.classes)
        results = model.predict(
            img, conf=DEFAULT_CONF if req.conf is None else req.conf,
            imgsz=IMAGE_SIZE, device=DEVICE, verbose=False,
        )

    detections = []
    for r in results:
        for box in r.boxes:
            # cls indexes into the classes we passed to set_classes (in order),
            # which is more robust than r.names (a list in some ultralytics versions).
            cls = int(box.cls[0])
            label = req.classes[cls] if 0 <= cls < len(req.classes) else str(cls)
            x1, y1, x2, y2 = (round(float(v), 5) for v in box.xyxyn[0])
            detections.append(
                {
                    "label": label,
                    "bbox": [x1, y1, x2, y2],
                    "score": round(float(box.conf[0]), 4),
                }
            )
    return {"detections": detections}
