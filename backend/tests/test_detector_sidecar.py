"""Check detector adapters without downloading model weights during tests."""

import base64
import importlib.util
import io
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from PIL import Image


@pytest.mark.parametrize("checkpoint,family", [
    ("yoloe-26s-seg.pt", "yoloe"),
    ("yolov8x-worldv2.pt", "yolo-world"),
])
def test_detector_adapter_preserves_labels_coordinates_and_zero_threshold(monkeypatch, checkpoint, family):
    calls = []

    class Model:
        def __init__(self, name):
            assert name == checkpoint

        def get_text_pe(self, classes):
            calls.append(("text", classes))
            return "embeddings"

        def set_classes(self, classes, *args):
            calls.append(("classes", classes, args))

        def predict(self, image, **kwargs):
            calls.append(("predict", image.size, kwargs))
            return [SimpleNamespace(boxes=[SimpleNamespace(cls=[1], xyxyn=[[0.1, 0.2, 0.7, 0.8]], conf=[0.9])])]

    monkeypatch.setitem(sys.modules, "ultralytics", SimpleNamespace(YOLOE=Model, YOLOWorld=Model))
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: False)))
    monkeypatch.setenv("DETECTOR_MODEL", checkpoint)
    monkeypatch.setenv("DETECTOR_IMGSZ", "960")
    monkeypatch.delenv("DETECTOR_DEVICE", raising=False)
    module_path = Path(__file__).resolve().parents[2] / "detector" / "server.py"
    spec = importlib.util.spec_from_file_location("detector_under_test", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    buffer = io.BytesIO()
    Image.new("RGB", (300, 200)).save(buffer, format="JPEG")

    with TestClient(module.app) as client:
        assert client.get("/health").json()["family"] == family
        assert client.post("/detect", json={"image_b64": "", "classes": []}).json() == {"detections": []}
        response = client.post("/detect", json={
            "image_b64": base64.b64encode(buffer.getvalue()).decode(),
            "classes": ["mug", "book"], "conf": 0,
        })
        assert response.json() == {"detections": [{"label": "book", "bbox": [0.1, 0.2, 0.7, 0.8], "score": 0.9}]}
        assert client.post("/detect", json={"image_b64": "", "classes": [], "conf": 2}).status_code == 422
    assert calls[-1] == ("predict", (300, 200), {"conf": 0, "imgsz": 960, "device": "cpu", "verbose": False})
    assert calls[-2] == ("classes", ["mug", "book"], ("embeddings",) if family == "yoloe" else ())
