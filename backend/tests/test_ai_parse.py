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
