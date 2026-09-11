"""Pydantic schemas for Item CRUD."""

from datetime import datetime
import math
from pydantic import BaseModel, Field, computed_field, field_validator


class ItemFields(BaseModel):
    @field_validator("name", check_fields=False)
    @classmethod
    def validate_name(cls, value):
        if value is None or not value.strip():
            raise ValueError("Enter an item name")
        return value.strip()

    @field_validator("tags", check_fields=False)
    @classmethod
    def validate_tags(cls, value):
        if value is None:
            raise ValueError("Tags must be a list")
        tags = list(dict.fromkeys(tag.strip() for tag in value if tag.strip()))
        if any(len(tag) > 100 for tag in tags):
            raise ValueError("Each tag must contain 100 characters or fewer")
        return tags

    @field_validator("notes", check_fields=False)
    @classmethod
    def validate_notes(cls, value):
        if value is None:
            raise ValueError("Notes must be text")
        return value

    @field_validator("bbox", check_fields=False)
    @classmethod
    def validate_bbox(cls, value):
        if value is None:
            return value
        if len(value) != 4 or any(not math.isfinite(v) or not 0 <= v <= 1 for v in value):
            raise ValueError("The image box must contain four coordinates from 0 to 1")
        if value[2] <= value[0] or value[3] <= value[1]:
            raise ValueError("The image box must have positive width and height")
        return value


def _storage_url(path: str | None) -> str | None:
    """Public URL for a stored image, from a path or bare filename."""
    if not path:
        return None
    return f"/api/storage/{path.rsplit('/', 1)[-1]}"


class ItemCreate(ItemFields):
    room_id: int = Field(gt=0)
    container_id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=1, max_length=500)
    category: str | None = Field(default=None, max_length=255)
    tags: list[str] = Field(default_factory=list, max_length=50)
    image_path: str | None = None
    scan_session_id: str | None = None
    confidence_score: float | None = Field(default=None, ge=0, le=1)
    bbox: list[float] | None = None  # [x1,y1,x2,y2] normalized 0..1, from the detector
    notes: str = Field(default="", max_length=10000)


class ItemUpdate(ItemFields):
    name: str | None = Field(default=None, min_length=1, max_length=500)
    category: str | None = Field(default=None, max_length=255)
    tags: list[str] | None = Field(default=None, max_length=50)
    container_id: int | None = Field(default=None, gt=0)
    notes: str | None = Field(default=None, max_length=10000)
    confidence_score: float | None = Field(default=None, ge=0, le=1)


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
    bbox: list[float] | None
    notes: str
    date_added: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def image_url(self) -> str | None:
        return _storage_url(self.image_path)


class ItemBulkCreate(BaseModel):
    """Used for batch-creating items from an AI scan result."""
    items: list[ItemCreate] = Field(min_length=1, max_length=500)


class ItemMove(BaseModel):
    """Move one or more items into a room (and optionally a container in it).

    Assigning a container implicitly places the item in that container's room,
    so `room_id` and `container_id` must be consistent (container ∈ room).
    """
    item_ids: list[int] = Field(min_length=1, max_length=500)
    room_id: int = Field(gt=0)
    container_id: int | None = Field(default=None, gt=0)


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
    container_path: str | None = None
    confidence_score: float | None
    image_path: str | None = None
    bbox: list[float] | None = None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def image_url(self) -> str | None:
        return _storage_url(self.image_path)
