"""Check scan recovery and atomic review saves with temporary data."""

import asyncio
import io
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base, get_db
from app.models.container import Container
from app.models.house import House
from app.models.item import Item
from app.models.room import Room
from app.models.scan_session import ScanSession
from app.routers import containers, rooms, scan
from app.schemas.scan import ScanResult, AIItem


@pytest.fixture
def catalogue(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'catalogue.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)
    monkeypatch.setattr(scan, "SessionLocal", sessions)
    monkeypatch.setattr(scan, "index_saved_items", lambda _: None)
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path / "uploads"))

    async def analyze(*args, **kwargs):
        return ScanResult(items=[AIItem(name="Mug")])

    monkeypatch.setattr(scan, "process_image_with_ai", analyze)
    with sessions() as db:
        db.add(House(id=1, name="Home"))
        db.add_all([Room(id=1, house_id=1, name="Kitchen"), Room(id=2, house_id=1, name="Office")])
        db.add_all([Container(id=1, room_id=1, name="Shelf"), Container(id=2, room_id=2, name="Desk")])
        db.add(ScanSession(id="scan-1", room_id=1, status="completed", result={"items": [{"name": "Mug"}]}))
        db.commit()

    def database():
        with sessions() as db:
            yield db

    app = FastAPI()
    app.include_router(scan.router)
    app.include_router(containers.router)
    app.include_router(rooms.router)
    app.dependency_overrides[get_db] = database
    with TestClient(app) as client:
        yield client, sessions
    engine.dispose()


def test_accept_saves_nested_containers_and_items_once(catalogue):
    client, sessions = catalogue
    payload = {
        "containers": [
            {"name": "Box", "proposed_parent_index": 1},
            {"name": "Drawer", "parent_id": 1},
        ],
        "items": [{"name": "  Mug  ", "proposed_container_index": 0}],
    }
    first = client.post("/api/scan/scan-1/accept", json=payload)
    second = client.post("/api/scan/scan-1/accept", json=payload)
    assert first.status_code == second.status_code == 200
    assert first.json()["item_ids"] == second.json()["item_ids"]
    assert second.json()["already_filed"] is True
    with sessions() as db:
        assert db.query(Item).count() == 1
        item = db.query(Item).one()
        assert item.name == "Mug"
        box = db.get(Container, item.container_id)
        drawer = db.get(Container, box.parent_id)
        assert box.name == "Box" and drawer.parent_id == 1
        assert db.get(ScanSession, "scan-1").status == "filed"
    assert client.get("/api/scan/active?room_id=1").json() == []


def test_concurrent_acceptance_creates_one_inventory(catalogue):
    client, sessions = catalogue
    payload = {"containers": [{"name": "Box"}], "items": [{"name": "Mug", "proposed_container_index": 0}]}
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post("/api/scan/scan-1/accept", json=payload), range(2)))
    assert [response.status_code for response in responses] == [200, 200]
    assert responses[0].json()["item_ids"] == responses[1].json()["item_ids"]
    with sessions() as db:
        assert db.query(Item).count() == 1
        assert db.query(Container).filter(Container.name == "Box").count() == 1


def test_accept_rejects_a_scan_that_moved_after_review_started(catalogue):
    client, sessions = catalogue
    before = client.get("/api/scan/scan-1").json()
    with sessions() as db:
        db.get(ScanSession, "scan-1").container_id = 1
        db.commit()
    assert client.post("/api/containers/1/move", json={"room_id": 2}).status_code == 200
    response = client.post("/api/scan/scan-1/accept", json={
        "room_id": 1,
        "expected_revision": before["result_revision"],
        "items": [{"name": "Mug"}],
    })
    assert response.status_code == 409
    with sessions() as db:
        assert db.query(Item).count() == 0
        assert db.get(ScanSession, "scan-1").status == "completed"


def test_retry_changes_revision_and_rejects_stale_review(catalogue, tmp_path):
    client, sessions = catalogue
    photo = tmp_path / "photo.jpg"
    photo.write_bytes(b"retained photo")
    with sessions() as db:
        db.get(ScanSession, "scan-1").image_path = str(photo)
        db.commit()
    before = client.get("/api/scan/scan-1").json()
    retry = client.post("/api/scan/scan-1/retry")
    assert retry.status_code == 200
    assert retry.json()["result_revision"] != before["result_revision"]
    after = client.get("/api/scan/scan-1").json()
    assert after["result_revision"] != before["result_revision"]
    response = client.post("/api/scan/scan-1/accept", json={
        "room_id": 1,
        "expected_revision": before["result_revision"],
        "items": [{"name": "Mug"}],
    })
    assert response.status_code == 409
    with sessions() as db:
        assert db.query(Item).count() == 0


def test_empty_acceptance_fails_but_container_only_save_succeeds(catalogue):
    client, sessions = catalogue
    assert client.post("/api/scan/scan-1/accept", json={}).status_code == 422
    response = client.post("/api/scan/scan-1/accept", json={"containers": [{"name": "Box"}]})
    assert response.status_code == 200
    assert response.json()["item_ids"] == []
    with sessions() as db:
        assert db.get(ScanSession, "scan-1").status == "filed"
        assert db.query(Container).filter(Container.name == "Box").count() == 1


@pytest.mark.parametrize("payload", [
    {"containers": [{"name": "Box"}], "items": [{"name": "Mug", "container_id": 2}]},
    {"containers": [{"name": "Box", "parent_id": 2}]},
    {"containers": [{"name": "Box", "proposed_parent_index": 0}]},
    {"containers": [{"name": "Box"}], "items": [{"name": "Mug", "proposed_container_index": 3}]},
    {"containers": [{"name": "Box"}], "items": [{"name": "  "}]},
])
def test_accept_rejects_invalid_review_without_partial_rows(catalogue, payload):
    client, sessions = catalogue
    response = client.post("/api/scan/scan-1/accept", json=payload)
    assert response.status_code in {400, 422}
    with sessions() as db:
        assert db.query(Container).count() == 2
        assert db.query(Item).count() == 0
        assert db.get(ScanSession, "scan-1").status == "completed"


def test_database_failure_rolls_back_containers_and_scan_claim(catalogue):
    client, sessions = catalogue

    def fail_insert(*args):
        raise RuntimeError("Simulated item insert failure")

    event.listen(Item, "before_insert", fail_insert)
    try:
        with pytest.raises(RuntimeError, match="Simulated item insert failure"):
            client.post("/api/scan/scan-1/accept", json={
                "containers": [{"name": "Box"}],
                "items": [{"name": "Mug", "proposed_container_index": 0}],
            })
    finally:
        event.remove(Item, "before_insert", fail_insert)
    with sessions() as db:
        assert db.query(Container).count() == 2
        assert db.query(Item).count() == 0
        assert db.get(ScanSession, "scan-1").status == "completed"


def test_active_scans_are_scoped_and_include_destination(catalogue):
    client, sessions = catalogue
    with sessions() as db:
        db.add_all([
            ScanSession(id="other-room", room_id=2, status="pending"),
            ScanSession(id="legacy-saved", room_id=1, status="completed"),
        ])
        db.add(Item(room_id=1, name="Saved mug", scan_session_id="legacy-saved"))
        db.commit()
    response = client.get("/api/scan/active?room_id=1")
    assert response.status_code == 200
    assert [row["scan_session_id"] for row in response.json()] == ["scan-1"]
    assert response.json()[0]["room_id"] == 1
    assert "container_id" in response.json()[0]


def test_restart_marks_interrupted_scans_for_retry(catalogue):
    _, sessions = catalogue
    with sessions() as db:
        db.add_all([
            ScanSession(id="queued", room_id=1, status="pending"),
            ScanSession(id="working", room_id=1, status="processing"),
            ScanSession(id="saved", room_id=1, status="filed"),
        ])
        db.commit()
    assert scan.recover_interrupted_scans() == 2
    assert scan.recover_interrupted_scans() == 0
    with sessions() as db:
        assert db.get(ScanSession, "queued").status == "failed"
        assert "restarted" in db.get(ScanSession, "working").error
        assert db.get(ScanSession, "saved").status == "filed"
        assert db.get(ScanSession, "scan-1").status == "completed"


def test_duplicate_background_delivery_runs_analysis_once(catalogue, monkeypatch):
    _, sessions = catalogue
    calls = []

    async def analyze(*args, **kwargs):
        calls.append(args)
        await asyncio.sleep(0)
        return ScanResult(items=[])

    monkeypatch.setattr(scan, "process_image_with_ai", analyze)
    with sessions() as db:
        db.get(ScanSession, "scan-1").status = "pending"
        db.commit()

    async def run():
        await asyncio.gather(scan._run_scan("scan-1", "photo.jpg", 1), scan._run_scan("scan-1", "photo.jpg", 1))

    asyncio.run(run())
    assert len(calls) == 1


def test_provider_failure_is_retryable_without_exposing_request_data(catalogue, monkeypatch):
    _, sessions = catalogue

    async def analyze(*args, **kwargs):
        raise RuntimeError("Authorization: Bearer private-test-value")

    monkeypatch.setattr(scan, "process_image_with_ai", analyze)
    with sessions() as db:
        db.get(ScanSession, "scan-1").status = "pending"
        db.commit()
    asyncio.run(scan._run_scan("scan-1", "photo.jpg", 1))
    with sessions() as db:
        sess = db.get(ScanSession, "scan-1")
        assert sess.status == "failed"
        assert "retry" in sess.error.lower()
        assert "private-test-value" not in sess.error


def test_upload_rejects_non_image_without_creating_a_scan(catalogue):
    client, sessions = catalogue
    response = client.post("/api/scan/upload", data={"room_id": 1}, files={"image": ("photo.jpg", b"not an image", "image/jpeg")})
    assert response.status_code == 415
    with sessions() as db:
        assert db.query(ScanSession).count() == 1


def test_upload_stores_normalized_photo_with_generated_filename(catalogue):
    client, sessions = catalogue
    image = io.BytesIO()
    Image.new("RGB", (40, 20), "white").save(image, format="PNG")
    response = client.post("/api/scan/upload", data={"room_id": 1}, files={"image": ("../../photo.html", image.getvalue(), "image/png")})
    assert response.status_code == 200
    with sessions() as db:
        sess = db.get(ScanSession, response.json()["scan_session_id"])
        assert sess.status == "completed"
        assert Path(sess.image_path).name.startswith(f"{sess.id}_")
        assert sess.image_path.endswith(".jpg")
        with Image.open(sess.image_path) as stored:
            assert stored.format == "JPEG"


def _photo_bytes():
    photo = io.BytesIO()
    Image.new("RGB", (40, 20), "white").save(photo, format="PNG")
    return photo.getvalue()


def test_upload_replay_returns_the_scan_without_repeating_inference(catalogue, monkeypatch):
    client, sessions = catalogue
    calls = []

    async def analyze(*args, **kwargs):
        calls.append(args)
        return ScanResult(items=[])

    monkeypatch.setattr(scan, "process_image_with_ai", analyze)
    request_id = str(uuid.uuid4())
    data = {"room_id": 1, "request_id": request_id}
    first = client.post("/api/scan/upload", data=data, files={"image": ("photo.png", _photo_bytes(), "image/png")})
    assert first.status_code == 200
    with sessions() as db:
        original_path = Path(db.get(ScanSession, request_id).image_path)
        original_bytes = original_path.read_bytes()
    replay = client.post("/api/scan/upload", data=data, files={"image": ("photo.png", _photo_bytes(), "image/png")})
    assert replay.status_code == 200
    assert first.json()["scan_session_id"] == replay.json()["scan_session_id"] == request_id
    assert replay.json()["status"] == "completed"
    assert len(calls) == 1
    assert original_path.read_bytes() == original_bytes
    assert list(Path(settings.upload_dir).iterdir()) == [original_path]


@pytest.mark.parametrize("destination", [{"room_id": 2}, {"room_id": 1, "container_id": 1}])
def test_upload_replay_rejects_a_different_destination(catalogue, destination):
    client, sessions = catalogue
    request_id = str(uuid.uuid4())
    first = client.post("/api/scan/upload", data={"room_id": 1, "request_id": request_id}, files={"image": ("photo.png", _photo_bytes())})
    assert first.status_code == 200
    replay = client.post("/api/scan/upload", data={**destination, "request_id": request_id}, files={"image": ("photo.png", _photo_bytes())})
    assert replay.status_code == 409
    with sessions() as db:
        assert db.get(ScanSession, request_id).room_id == 1
    assert len(list(Path(settings.upload_dir).iterdir())) == 1


@pytest.mark.parametrize("different_destinations", [False, True])
def test_concurrent_upload_replay_keeps_only_the_winning_photo(catalogue, monkeypatch, different_destinations):
    client, sessions = catalogue
    barrier = Barrier(2)
    saved_paths = []
    calls = []
    save_photo = scan.save_upload

    def save_concurrently(image, filename):
        path = save_photo(image, filename)
        saved_paths.append(Path(path))
        barrier.wait(timeout=5)
        return path

    async def analyze(*args, **kwargs):
        calls.append(args)
        return ScanResult(items=[])

    monkeypatch.setattr(scan, "save_upload", save_concurrently)
    monkeypatch.setattr(scan, "process_image_with_ai", analyze)
    request_id = str(uuid.uuid4())

    def upload(index):
        room_id = index + 1 if different_destinations else 1
        return client.post("/api/scan/upload", data={"room_id": room_id, "request_id": request_id}, files={"image": ("photo.png", _photo_bytes())})

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(upload, range(2)))
    assert sorted(response.status_code for response in responses) == ([200, 409] if different_destinations else [200, 200])
    assert len(saved_paths) == 2
    assert len(set(saved_paths)) == 2
    assert len(calls) == 1
    with sessions() as db:
        assert db.query(ScanSession).filter(ScanSession.id == request_id).count() == 1
        winner = Path(db.get(ScanSession, request_id).image_path)
    assert winner.is_file()
    assert list(Path(settings.upload_dir).iterdir()) == [winner]
    assert not next(path for path in saved_paths if path != winner).exists()


def test_upload_rejects_an_invalid_request_id_before_saving(catalogue):
    client, _ = catalogue
    response = client.post("/api/scan/upload", data={"room_id": 1, "request_id": "not-a-uuid"}, files={"image": ("photo.png", _photo_bytes())})
    assert response.status_code == 422
    assert not Path(settings.upload_dir).exists()


def test_container_edit_rejects_cross_room_parent_and_cycle(catalogue):
    client, sessions = catalogue
    assert client.put("/api/containers/1", json={"parent_id": 2}).status_code == 400
    with sessions() as db:
        db.add(Container(id=3, room_id=1, name="Drawer", parent_id=1))
        db.commit()
    assert client.put("/api/containers/1", json={"parent_id": 3}).status_code == 400
    assert client.put("/api/containers/1", json={"parent_id": 1}).status_code == 400


@pytest.mark.parametrize("payload", [{"name": "  "}, {"name": None}, {"description": None}])
def test_location_edits_reject_blank_or_null_fields(catalogue, payload):
    client, _ = catalogue
    assert client.put("/api/rooms/1", json=payload).status_code == 422
    assert client.put("/api/containers/1", json=payload).status_code == 422


def test_container_move_updates_scan_destination(catalogue):
    client, sessions = catalogue
    with sessions() as db:
        db.get(ScanSession, "scan-1").container_id = 1
        db.commit()
    assert client.post("/api/containers/1/move", json={"room_id": 2}).status_code == 200
    with sessions() as db:
        assert db.get(ScanSession, "scan-1").room_id == 2


def test_room_delete_removes_scan_sessions(catalogue):
    client, sessions = catalogue
    assert client.delete("/api/rooms/1").status_code == 204
    with sessions() as db:
        assert db.get(ScanSession, "scan-1") is None
