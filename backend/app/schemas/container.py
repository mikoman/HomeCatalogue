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
