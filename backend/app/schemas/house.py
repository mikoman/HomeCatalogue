"""Pydantic schemas for House CRUD."""

from datetime import datetime
from pydantic import BaseModel


class HouseCreate(BaseModel):
    name: str
    description: str = ""


class HouseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class HouseRead(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
