"""Pydantic schemas for Container CRUD."""

from datetime import datetime
from pydantic import BaseModel


class ContainerCreate(BaseModel):
    room_id: int
    parent_id: int | None = None
    name: str
    description: str = ""


class ContainerUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    parent_id: int | None = None


class ContainerRead(BaseModel):
    id: int
    room_id: int
    parent_id: int | None
    name: str
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContainerMove(BaseModel):
    """Re-home a container (and its whole subtree) into another room.

    The moved container is detached to a root (parent_id = null) in the new
    room, since its old parent stays behind. Same-house only.
    """
    room_id: int
