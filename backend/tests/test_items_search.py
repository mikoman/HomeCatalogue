"""Item validation and catalogue search regression tests."""

from contextlib import contextmanager
import pytest
from fastapi import BackgroundTasks, HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import database
from app.database import Base
from app.models import Container, House, Item, Room, ScanSession
from app.routers import items as item_routes
from app.schemas.item import ItemBulkCreate, ItemCreate, ItemMove, ItemUpdate
from app.services import embeddings, search


@pytest.fixture
def catalogue(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    monkeypatch.setattr(item_routes, "embed_text", lambda text: None)
    with Session(engine) as db:
        home = House(name="Home")
        elsewhere = House(name="Other home")
        db.add_all([home, elsewhere])
        db.flush()
        kitchen = Room(name="Kitchen", house_id=home.id)
        office = Room(name="Office", house_id=home.id)
        remote = Room(name="Bedroom", house_id=elsewhere.id)
        db.add_all([kitchen, office, remote])
        db.flush()
        cupboard = Container(name="Cupboard", room_id=kitchen.id)
        db.add(cupboard)
        db.flush()
        drawer = Container(name="Top drawer", room_id=kitchen.id, parent_id=cupboard.id)
        db.add(drawer)
        db.commit()
        yield db, kitchen, office, remote, drawer
    engine.dispose()


def add_item(db, room, name, **values):
    item = Item(room_id=room.id, name=name, **values)
    db.add(item)
    db.commit()
    return item


def test_keyword_search_does_not_call_ai(catalogue, monkeypatch):
    db, room, *_ = catalogue
    expected = add_item(db, room, "Batteries")

    def unexpected_call(text):
        pytest.fail("Keyword search must not call the embedding service")

    monkeypatch.setattr(search, "embed_text", unexpected_call)
    assert [row[0].id for row in search.hybrid_search(db, "battery")] == []
    assert [row[0].id for row in search.hybrid_search(db, "batteries")] == [expected.id]
    assert search.hybrid_search(db, "   ") == []


@pytest.mark.parametrize("term,expected", [("%", "100% cotton"), ("_", "usb_c cable"), ("\\", "a\\b")])
def test_search_treats_wildcards_as_literal_text(catalogue, term, expected):
    db, room, *_ = catalogue
    for name in ["100% cotton", "usb_c cable", "a\\b", "Other item"]:
        add_item(db, room, name)
    assert [row[0].name for row in search.hybrid_search(db, term)] == [expected]


def test_search_matches_words_across_item_fields_and_location(catalogue):
    db, room, *_ = catalogue
    expected = add_item(db, room, "USB cable", category="Electronics", tags=["blue"])
    add_item(db, room, "Blue mug", category="Tableware")
    rows = search.hybrid_search(db, "blue cable kitchen")
    assert [row[0].id for row in rows] == [expected.id]


def test_exact_name_precedes_partial_name(catalogue):
    db, room, *_ = catalogue
    add_item(db, room, "AAA Batteries")
    exact = add_item(db, room, "Batteries")
    assert search.hybrid_search(db, "batteries")[0][0].id == exact.id


def test_semantic_search_is_optional_and_skips_full_keyword_page(catalogue, monkeypatch):
    db, room, *_ = catalogue
    exact = add_item(db, room, "Cable", embedding=[1.0, 0.0])
    related = add_item(db, room, "Wire", embedding=[1.0, 0.0])
    calls = []
    monkeypatch.setattr(search, "embed_text", lambda text: calls.append(text) or [1.0, 0.0])
    assert [r[0].id for r in search.hybrid_search(db, "cable", limit=1, semantic=True)] == [exact.id]
    assert calls == []
    assert [r[0].id for r in search.hybrid_search(db, "cable", semantic=True)] == [exact.id, related.id]
    assert calls == ["cable"]


def test_search_returns_container_path_and_box(catalogue):
    db, kitchen, _, _, drawer = catalogue
    bbox = [0.1, 0.2, 0.6, 0.7]
    add_item(db, kitchen, "Spoon", container_id=drawer.id, bbox=bbox)
    rows = item_routes.search_items(q="spoon", limit=100, semantic=False, db=db)
    assert rows[0].container_path == "Cupboard / Top drawer"
    assert rows[0].bbox == bbox


def test_scoped_search_applies_order_before_limit(catalogue):
    db, kitchen, office, *_ = catalogue
    add_item(db, kitchen, "Kitchen cable")
    add_item(db, office, "Office cable")
    assert [item.name for item in search.search_items(db, "cable", room_id=kitchen.id, limit=1)] == ["Kitchen cable"]


@pytest.mark.parametrize("name", ["", "   ", "x" * 501])
def test_item_name_must_be_nonempty_and_bounded(name):
    with pytest.raises(ValidationError):
        ItemCreate(room_id=1, name=name)


def test_item_fields_trim_and_deduplicate_tags():
    data = ItemCreate(room_id=1, name="  Cable  ", tags=[" blue ", "", "blue"])
    assert data.name == "Cable"
    assert data.tags == ["blue"]


@pytest.mark.parametrize("field", ["name", "tags", "notes"])
def test_update_cannot_clear_required_fields_with_null(field):
    with pytest.raises(ValidationError):
        ItemUpdate(**{field: None})
    assert ItemUpdate().model_dump(exclude_unset=True) == {}


@pytest.mark.parametrize("bbox", [[0, 0, 1], [0, 0, 2, 1], [1, 0, 0, 1], [0, 0, 0, 1], [0, 0, float("nan"), 1]])
def test_item_box_requires_valid_coordinates(bbox):
    with pytest.raises(ValidationError):
        ItemCreate(room_id=1, name="Cable", bbox=bbox)


def test_create_rejects_container_from_another_room(catalogue):
    db, _, office, _, drawer = catalogue
    with pytest.raises(HTTPException) as error:
        item_routes.create_item(ItemCreate(room_id=office.id, container_id=drawer.id, name="Cable"), BackgroundTasks(), db=db)
    assert error.value.status_code == 400
    assert db.query(Item).count() == 0


def test_create_rejects_scan_from_another_room(catalogue):
    db, kitchen, office, *_ = catalogue
    db.add(ScanSession(id="kitchen-scan", room_id=kitchen.id, status="completed"))
    db.commit()
    with pytest.raises(HTTPException) as error:
        item_routes.create_item(ItemCreate(room_id=office.id, name="Cable", scan_session_id="kitchen-scan"), BackgroundTasks(), db=db)
    assert error.value.status_code == 400
    assert db.query(Item).count() == 0


def test_create_inherits_the_scan_photo(catalogue):
    db, kitchen, *_ = catalogue
    db.add(ScanSession(id="photo", room_id=kitchen.id, status="completed", image_path="/private/photos/photo.jpg"))
    db.commit()
    item = item_routes.create_item(ItemCreate(room_id=kitchen.id, name="Cable", scan_session_id="photo"), BackgroundTasks(), db=db)
    assert item.image_path == "photo.jpg"


def test_bulk_validates_all_items_before_adding_any(catalogue):
    db, kitchen, office, _, drawer = catalogue
    data = ItemBulkCreate(items=[
        ItemCreate(room_id=kitchen.id, name="First"),
        ItemCreate(room_id=office.id, container_id=drawer.id, name="Invalid"),
    ])
    with pytest.raises(HTTPException):
        item_routes.bulk_create_items(data, BackgroundTasks(), db=db)
    assert not db.new
    assert db.query(Item).count() == 0


def test_move_validates_all_items_before_mutation(catalogue):
    db, kitchen, office, remote, _ = catalogue
    first = add_item(db, kitchen, "Local item")
    second = add_item(db, remote, "Other home item")
    with pytest.raises(HTTPException):
        item_routes.move_items(ItemMove(item_ids=[first.id, second.id], room_id=office.id), db=db)
    assert first.room_id == kitchen.id
    assert not db.dirty


def test_update_rejects_container_from_another_room(catalogue):
    db, _, office, _, drawer = catalogue
    item = add_item(db, office, "Cable")
    with pytest.raises(HTTPException):
        item_routes.update_item(item.id, ItemUpdate(container_id=drawer.id), BackgroundTasks(), db=db)
    assert item.container_id is None


def test_create_and_update_queue_embeddings_after_saving(catalogue, monkeypatch):
    db, kitchen, *_ = catalogue

    def unexpected_call(text):
        pytest.fail("Saving an item must not wait for embeddings")

    monkeypatch.setattr(item_routes, "embed_text", unexpected_call)
    monkeypatch.setattr(embeddings, "embed_text", unexpected_call)
    background = BackgroundTasks()
    item = item_routes.create_item(ItemCreate(room_id=kitchen.id, name="Cable"), background, db=db)
    assert item.id is not None
    assert item.embedding is None
    assert background.tasks[0].func is embeddings.index_saved_items
    assert background.tasks[0].args == ([item.id],)

    item.embedding = [1.0, 0.0]
    db.commit()
    background = BackgroundTasks()
    item_routes.update_item(item.id, ItemUpdate(name="USB cable"), background, db=db)
    assert item.name == "USB cable"
    assert item.embedding is None
    assert background.tasks[0].args == ([item.id],)


def test_bulk_create_queues_one_background_index(catalogue, monkeypatch):
    db, kitchen, *_ = catalogue

    def unexpected_call(text):
        pytest.fail("Saving a batch must not wait for embeddings")

    monkeypatch.setattr(item_routes, "embed_text", unexpected_call)
    background = BackgroundTasks()
    saved = item_routes.bulk_create_items(ItemBulkCreate(items=[
        ItemCreate(room_id=kitchen.id, name="First"),
        ItemCreate(room_id=kitchen.id, name="Second"),
    ]), background, db=db)
    assert len(saved) == 2
    assert len(background.tasks) == 1
    assert background.tasks[0].args == ([item.id for item in saved],)


@pytest.mark.parametrize("change_during_inference", [False, True])
def test_background_index_releases_session_and_rejects_changed_items(catalogue, monkeypatch, change_during_inference):
    db, kitchen, *_ = catalogue
    item = add_item(db, kitchen, "Cable")
    item_id = item.id
    version = item.updated_at
    active_sessions = 0

    @contextmanager
    def session_factory():
        nonlocal active_sessions
        active_sessions += 1
        try:
            with Session(db.get_bind()) as session:
                yield session
        finally:
            active_sessions -= 1

    def infer(source):
        assert source == "Cable"
        assert active_sessions == 0
        if change_during_inference:
            with Session(db.get_bind()) as writer:
                writer.get(Item, item_id).name = "Updated cable"
                writer.commit()
        return [1.0, 0.0]

    monkeypatch.setattr(database, "SessionLocal", session_factory)
    monkeypatch.setattr(embeddings, "embed_text", infer)
    embeddings.index_saved_items([item_id])
    db.expire_all()
    current = db.get(Item, item_id)
    if change_during_inference:
        assert current.name == "Updated cable"
        assert current.embedding is None
    else:
        assert current.embedding == [1.0, 0.0]
        assert current.updated_at == version
