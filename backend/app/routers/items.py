"""CRUD router for Items."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from app.database import get_db
from app.models.item import Item
from app.models.room import Room
from app.models.container import Container
from app.schemas.item import ItemCreate, ItemUpdate, ItemRead, ItemBulkCreate, ItemMove

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
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Item.name.ilike(search_pattern),
                Item.category.ilike(search_pattern),
                Item.tags.astext.contains(search),  # JSON array contains
            )
        )
    return query.order_by(Item.name).all()


@router.post("/", response_model=ItemRead, status_code=201)
def create_item(data: ItemCreate, db: Session = Depends(get_db)):
    if not db.query(Room).filter(Room.id == data.room_id).first():
        raise HTTPException(status_code=404, detail="Room not found")
    item = Item(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/bulk", response_model=List[ItemRead], status_code=201)
def bulk_create_items(data: ItemBulkCreate, db: Session = Depends(get_db)):
    """Create multiple items in a single transaction (used for scan results)."""
    created = []
    for item_data in data.items:
        item = Item(**item_data.model_dump())
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


@router.get("/{item_id}", response_model=ItemRead)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/{item_id}", response_model=ItemRead)
def update_item(item_id: int, data: ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
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
