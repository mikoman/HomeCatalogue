"""Container-path composition for catalogue export (the nested/recursive bit)."""

from types import SimpleNamespace
from app.routers.export import compose_container_paths


def _c(id, name, parent_id=None):
    return SimpleNamespace(id=id, name=name, parent_id=parent_id)


def test_nested_paths():
    paths = compose_container_paths([
        _c(1, "Wardrobe"),
        _c(2, "Top Drawer", parent_id=1),
        _c(3, "Sock Box", parent_id=2),
    ])
    assert paths[1] == "Wardrobe"
    assert paths[2] == "Wardrobe / Top Drawer"
    assert paths[3] == "Wardrobe / Top Drawer / Sock Box"


def test_missing_parent_is_root():
    paths = compose_container_paths([_c(5, "Orphan", parent_id=99)])
    assert paths[5] == "Orphan"


def test_cycle_terminates():
    # Corrupt data: 1 -> 2 -> 1. Must not infinite-loop.
    paths = compose_container_paths([_c(1, "A", parent_id=2), _c(2, "B", parent_id=1)])
    assert paths[1] and paths[2]
