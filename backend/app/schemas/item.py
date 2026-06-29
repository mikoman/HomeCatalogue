"""Pydantic schemas for Item CRUD."""

from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class ItemCreate(BaseModel):
    room_id: int
    container_id: int | None = None
    name: str
    category: str | None = None
    tags: list[str] = []
    image_path: str | None = None
    scan_session_id: str | None = None
    confidence_score: float | None = None
    notes: str = ""


class ItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    container_id: int | None = None
    notes: str | None = None
    confidence_score: float | None = None


class ItemRead(BaseModel):
    id: int
    room_id: int
    container_id: int | None
    name: str
    category: str | None
    tags: list[str]
    image_path: str | None
    scan_session_id: str | None
    confidence_score: float | None
    notes: str
    date_added: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ItemBulkCreate(BaseModel):
    """Used for batch-creating items from an AI scan result."""
    items: list[ItemCreate]


class ItemMove(BaseModel):
    """Move one or more items into a room (and optionally a container in it).

    Assigning a container implicitly places the item in that container's room,
    so `room_id` and `container_id` must be consistent (container ∈ room).
    """
    item_ids: list[int]
    room_id: int
    container_id: int | None = None


class ItemSearchResult(BaseModel):
    id: int
    name: str
    category: str | None
    tags: list[str]
    room_id: int
    room_name: str
    house_id: int
    house_name: str
    container_id: int | None
    container_name: str | None
    confidence_score: float | None

    model_config = {"from_attributes": True}
