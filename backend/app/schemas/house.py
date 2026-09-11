"""Pydantic schemas for House CRUD."""

from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.location import LocationFields


class HouseCreate(LocationFields):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=1000)


class HouseUpdate(LocationFields):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class HouseRead(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
