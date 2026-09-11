"""Robustness checks for AI scan-result parsing (the most failure-prone path)."""

from app.services.ai_vision import _parse_scan_result, _extract_json
import pytest


def test_plain_json():
    r = _parse_scan_result('{"items": [{"name": "Olive Oil", "category": "Food"}]}')
    assert [i.name for i in r.items] == ["Olive Oil"]


def test_fenced_json():
    content = '```json\n{"items": [{"name": "Mug"}]}\n```'
    r = _parse_scan_result(content)
    assert [i.name for i in r.items] == ["Mug"]


def test_prose_wrapped_json():
    content = 'Sure! Here is the inventory:\n{"items": [{"name": "Hammer"}]}\nHope that helps.'
    r = _parse_scan_result(content)
    assert [i.name for i in r.items] == ["Hammer"]


def test_skips_nameless_items_and_missing_containers():
    # No proposed_containers key; one item has no name → kept-partial, no raise.
    content = '{"items": [{"name": "Screwdriver"}, {"category": "Junk"}]}'
    r = _parse_scan_result(content)
    assert [i.name for i in r.items] == ["Screwdriver"]
    assert r.proposed_containers == []


def test_garbage_raises():
    with pytest.raises(ValueError):
        _extract_json("the model said no")


@pytest.mark.parametrize("content", [None, "", "{}", "[]", '{"items": {}}', '{"items": [null, 12, {}]}'])
def test_unusable_response_requests_retry(content):
    with pytest.raises(ValueError):
        _parse_scan_result(content)


def test_empty_inventory_is_valid():
    assert _parse_scan_result('{"items": []}').items == []


def test_optional_model_fields_do_not_lose_valid_items():
    result = _parse_scan_result('{"items": [null, {"name": " Mug ", "tags": " cup ", "confidence_score": null, "detection_label": 4}]}')
    assert result.items[0].name == "Mug"
    assert result.items[0].tags == ["cup"]
    assert result.items[0].confidence_score == 0.5
    assert result.items[0].detection_label is None
