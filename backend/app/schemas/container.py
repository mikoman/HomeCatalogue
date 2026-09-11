"""Pydantic schemas for Container CRUD."""

from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.location import LocationFields


class ContainerCreate(LocationFields):
    room_id: int = Field(gt=0)
    parent_id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=10000)


class ContainerUpdate(LocationFields):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    parent_id: int | None = Field(default=None, gt=0)


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
    room_id: int = Field(gt=0)
