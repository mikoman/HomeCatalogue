"""Detector box association + the image-cap speed lever."""

import io

from PIL import Image

from app.services.ai_vision import _associate, _capped_jpeg_bytes, _normalize_bbox
from app.schemas.scan import AIItem
from app.config import settings


def _item(name, label=None):
    return AIItem(name=name, detection_label=label)


def test_associate_matches_by_detection_label():
    items = [_item("Olive Oil Bottle", "bottle"), _item("Paperback", "book")]
    dets = [
        {"label": "bottle", "bbox": [0.1, 0.1, 0.2, 0.3], "score": 0.9},
        {"label": "book", "bbox": [0.5, 0.5, 0.6, 0.7], "score": 0.8},
    ]
    _associate(items, dets)
    assert items[0].bbox == [0.1, 0.1, 0.2, 0.3]
    assert items[1].bbox == [0.5, 0.5, 0.6, 0.7]


def test_associate_highest_score_first_then_runs_out():
    items = [_item("Bottle A", "bottle"), _item("Bottle B", "bottle"), _item("Bottle C", "bottle")]
    dets = [
        {"label": "bottle", "bbox": [0, 0, 1, 1], "score": 0.5},
        {"label": "bottle", "bbox": [0.2, 0.2, 0.4, 0.4], "score": 0.95},
    ]
    _associate(items, dets)
    assert items[0].bbox == [0.2, 0.2, 0.4, 0.4]  # highest score wins the first item
    assert items[1].bbox == [0, 0, 1, 1]
    assert items[2].bbox is None  # ran out of boxes — still catalogued, no outline


def test_associate_falls_back_to_name_and_leaves_unmatched_none():
    items = [_item("mug"), _item("Mystery Gadget", "widget")]
    dets = [{"label": "mug", "bbox": [0.1, 0.1, 0.2, 0.2], "score": 0.7}]
    _associate(items, dets)
    assert items[0].bbox == [0.1, 0.1, 0.2, 0.2]  # matched on name (no detection_label)
    assert items[1].bbox is None  # nothing detected for "widget"


def test_bad_optional_detections_do_not_make_review_unsavable():
    items = [_item("Mug", "mug")]
    _associate(items, [
        None,
        {"label": "mug", "bbox": [0, 0, float("nan"), 1]},
        {"label": "mug", "bbox": [0, 0, 2, 1]},
        {"label": "mug", "bbox": [1, 1, 0, 0]},
        {"label": "mug", "bbox": [0, 0, 0.5, 0.5], "score": 0.8},
    ])
    assert items[0].bbox == [0, 0, 0.5, 0.5]


def test_capped_jpeg_downscales_and_preserves_aspect(tmp_path):
    src = tmp_path / "big.jpg"
    Image.new("RGB", (2000, 1000), "white").save(src)
    out = Image.open(io.BytesIO(_capped_jpeg_bytes(str(src))))
    assert max(out.size) == settings.scan_max_edge
    assert abs(out.width / out.height - 2.0) < 0.02  # aspect preserved


def test_capped_jpeg_leaves_small_images_untouched(tmp_path):
    src = tmp_path / "small.png"
    Image.new("RGB", (300, 200), "white").save(src)
    out = Image.open(io.BytesIO(_capped_jpeg_bytes(str(src))))
    assert out.size == (300, 200)


def test_explicit_grounding_coordinates_do_not_guess_units_from_box_size():
    assert _normalize_bbox([0, 0, 1, 1], 0, 0, coordinate_space="normalized_1000") == [0, 0, 0.001, 0.001]
    assert _normalize_bbox([100, 200, 800, 900], 0, 0, coordinate_space="normalized_1000") == [0.1, 0.2, 0.8, 0.9]
    assert _normalize_bbox([0, 0, 1200, 900], 2000, 1000, coordinate_space="normalized_1000") is None
    assert _normalize_bbox([0, 0, float("nan"), 900], 0, 0, coordinate_space="normalized_1000") is None
    assert _normalize_bbox(None, 0, 0, coordinate_space="normalized_1000") is None
