"""YOLO-World detector sidecar — open-vocabulary boxes for the scan pipeline.

Runs on the host (picks up Apple-Silicon MPS / CUDA automatically). The backend
calls /detect over HTTP with the VLM-derived class list and gets boxes back
normalized to 0..1, so image resolution / downscaling is irrelevant downstream.

Run:  pip install -r requirements.txt && uvicorn server:app --port 8077
"""

import base64
import io
import os
import threading

import torch
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image
from ultralytics import YOLOWorld

# Large open-vocab model — much better recall on household items than -s; slower on
# CPU (a few seconds/image, fine vs the VLM). Use yolov8s-worldv2.pt for speed.
MODEL_NAME = os.getenv("DETECTOR_MODEL", "yolov8x-worldv2.pt")
DEFAULT_CONF = float(os.getenv("DETECTOR_CONF", "0.1"))


def _auto_device() -> str:
    """Pick a reliable device. CUDA works for YOLO-World; Apple MPS does NOT — its
    CLIP text encoder errors on set_classes ("Placeholder storage ... on MPS"), so
    we use CPU on Mac (fast enough for one image). Override with DETECTOR_DEVICE.
    """
    if torch.cuda.is_available():
        return "0"
    return "cpu"


DEVICE = os.getenv("DETECTOR_DEVICE") or _auto_device()

model = YOLOWorld(MODEL_NAME)  # weights auto-download on first run
# set_classes mutates the model in place, so serialize concurrent scans.
# ponytail: one global lock; fine at one detect per scan, shard if throughput grows.
_lock = threading.Lock()

# Warm the open-vocab text encoder at boot (it downloads on the first set_classes),
# so the first real scan isn't slow. Best-effort — never block startup on it.
try:
    model.set_classes(["object"])
except Exception:  # noqa: BLE001
    pass

app = FastAPI(title="YOLO-World detector")


class DetectRequest(BaseModel):
    image_b64: str
    classes: list[str]
    conf: float | None = None


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME, "device": DEVICE}


@app.post("/detect")
def detect(req: DetectRequest):
    """Detect req.classes in the image; return boxes normalized to 0..1."""
    if not req.classes:
        return {"detections": []}
    img = Image.open(io.BytesIO(base64.b64decode(req.image_b64))).convert("RGB")
    with _lock:
        model.set_classes(req.classes)
        results = model.predict(img, conf=req.conf or DEFAULT_CONF, device=DEVICE, verbose=False)

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
