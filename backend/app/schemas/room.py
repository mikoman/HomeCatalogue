"""Pydantic schemas for Room CRUD."""

from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.location import LocationFields


class RoomCreate(LocationFields):
    house_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=1000)


class RoomUpdate(LocationFields):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class RoomRead(BaseModel):
    id: int
    house_id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
