"""CRUD router for Items."""

import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.item import Item
from app.models.room import Room
from app.models.container import Container
from app.models.house import House
from app.models.scan_session import ScanSession
from app.schemas.item import ItemCreate, ItemUpdate, ItemRead, ItemBulkCreate, ItemMove, ItemSearchResult
from app.schemas.container import ContainerRead
from app.services.search import item_search_filter, hybrid_search
from app.services.embeddings import embed_text, embed_source

router = APIRouter(prefix="/api/items", tags=["items"])


@router.get("/", response_model=List[ItemRead])
def list_items(
    room_id: int | None = None,
    container_id: int | None = None,
    search: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Item)
    if room_id is not None:
        query = query.filter(Item.room_id == room_id)
    if container_id is not None:
        query = query.filter(Item.container_id == container_id)
    if category:
        query = query.filter(Item.category == category)
    if search:
        query = query.filter(item_search_filter(search))
    return query.order_by(Item.name).all()


@router.get("/search", response_model=List[ItemSearchResult])
def search_items(
    q: str = Query(..., min_length=1),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Search items across the catalogue with room/house/container context.

    Hybrid: keyword matches first, then semantic matches when an embedding
    model is configured (see Settings). Falls back to keyword-only otherwise.
    """
    rows = hybrid_search(db, q, limit=limit)
    return [
        ItemSearchResult(
            id=item.id,
            name=item.name,
            category=item.category,
            tags=item.tags or [],
            room_id=room.id,
            room_name=room.name,
            house_id=house.id,
            house_name=house.name,
            container_id=container.id if container else None,
            container_name=container.name if container else None,
            confidence_score=item.confidence_score,
            image_path=item.image_path,
        )
        for item, room, house, container in rows
    ]


@router.post("/", response_model=ItemRead, status_code=201)
def create_item(data: ItemCreate, db: Session = Depends(get_db)):
    if not db.query(Room).filter(Room.id == data.room_id).first():
        raise HTTPException(status_code=404, detail="Room not found")
    item = Item(**data.model_dump())
    item.embedding = embed_text(embed_source(item))  # None if embeddings disabled
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/bulk", response_model=List[ItemRead], status_code=201)
def bulk_create_items(data: ItemBulkCreate, db: Session = Depends(get_db)):
    """Create multiple items in a single transaction (used for scan results).

    Items carrying a scan_session_id inherit that scan's photo as their
    thumbnail, so the catalogue is visual without a per-item upload.
    """
    created = []
    image_by_session: dict[str, str | None] = {}
    for item_data in data.items:
        payload = item_data.model_dump()
        sid = payload.get("scan_session_id")
        if sid and not payload.get("image_path"):
            if sid not in image_by_session:
                sess = db.query(ScanSession).filter(ScanSession.id == sid).first()
                image_by_session[sid] = (
                    os.path.basename(sess.image_path) if sess and sess.image_path else None
                )
            payload["image_path"] = image_by_session[sid]
        item = Item(**payload)
        item.embedding = embed_text(embed_source(item))
        db.add(item)
        created.append(item)
    db.commit()
    for item in created:
        db.refresh(item)
    return created


@router.post("/move", response_model=List[ItemRead])
def move_items(data: ItemMove, db: Session = Depends(get_db)):
    """Move one or more items into a target room and (optionally) a container.

    Same-house only. If a container_id is given it must belong to the target
    room; assigning it also fixes the item's room_id to that container's room,
    normalizing any latent item.room_id != container.room_id rows.
    """
    target_room = db.query(Room).filter(Room.id == data.room_id).first()
    if not target_room:
        raise HTTPException(status_code=404, detail="Target room not found")

    if data.container_id is not None:
        container = db.query(Container).filter(Container.id == data.container_id).first()
        if not container:
            raise HTTPException(status_code=404, detail="Container not found")
        if container.room_id != target_room.id:
            raise HTTPException(
                status_code=400,
                detail="Container must be in the target room",
            )

    moved = []
    for item_id in data.item_ids:
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
        current_room = db.query(Room).filter(Room.id == item.room_id).first()
        if current_room and current_room.house_id != target_room.house_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot move items between houses",
            )
        item.room_id = target_room.id
        item.container_id = data.container_id
        moved.append(item)

    db.commit()
    for item in moved:
        db.refresh(item)
    return moved


@router.post("/reindex-embeddings")
def reindex_embeddings(db: Session = Depends(get_db)):
    """Recompute every item's embedding (run after setting/changing the model).

    No-op (embedded=0) when no embedding model is configured.
    """
    items = db.query(Item).all()
    embedded = 0
    for it in items:
        vec = embed_text(embed_source(it))
        if vec:
            it.embedding = vec
            embedded += 1
    db.commit()
    return {"total": len(items), "embedded": embedded}


@router.get("/{item_id}", response_model=ItemRead)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.post("/{item_id}/promote-to-container", response_model=ContainerRead, status_code=201)
def promote_item_to_container(item_id: int, db: Session = Depends(get_db)):
    """Convert an item into a real container (same name, notes become description)."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.container_id is not None:
        parent = db.query(Container).filter(Container.id == item.container_id).first()
        if not parent or parent.room_id != item.room_id:
            raise HTTPException(status_code=400, detail="Invalid parent container for this item")

    container = Container(
        room_id=item.room_id,
        parent_id=item.container_id,
        name=item.name,
        description=item.notes or "",
    )
    db.add(container)
    db.delete(item)
    db.commit()
    db.refresh(container)
    return container


@router.put("/{item_id}", response_model=ItemRead)
def update_item(item_id: int, data: ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(item, key, value)
    if changes.keys() & {"name", "category", "tags"}:
        item.embedding = embed_text(embed_source(item))
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
