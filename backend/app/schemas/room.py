"""Pydantic schemas for Room CRUD."""

from datetime import datetime
from pydantic import BaseModel


class RoomCreate(BaseModel):
    house_id: int
    name: str
    description: str = ""


class RoomUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class RoomRead(BaseModel):
    id: int
    house_id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
