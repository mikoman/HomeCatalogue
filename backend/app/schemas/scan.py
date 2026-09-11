"""Pydantic schemas for scan/scan-result requests and responses."""

from datetime import datetime
from pydantic import BaseModel, Field, StringConstraints, model_validator
from typing import Annotated


class AIContainer(BaseModel):
    name: str
    description: str = ""


class AIItem(BaseModel):
    name: str
    category: str | None = None
    tags: list[str] = []
    suggested_container: str | None = None
    confidence_score: float = 0.5
    detection_label: str | None = None  # short generic noun the detector localizes on
    bbox: list[float] | None = None  # [x1,y1,x2,y2] normalized 0..1, filled by the detector


class ScanResult(BaseModel):
    proposed_containers: list[AIContainer] = []
    items: list[AIItem] = []


class ScanUploadResponse(BaseModel):
    """Returned immediately by POST /scan/upload. Inference runs async."""
    scan_session_id: str
    status: str = "pending"


class ScanStatusResponse(BaseModel):
    """Polled by the frontend via GET /scan/{id} until status is terminal."""
    scan_session_id: str
    status: str  # pending | processing | completed | failed | filed
    room_id: int
    container_id: int | None = None
    result_revision: str | None = None
    image_url: str | None = None
    result: ScanResult | None = None
    error: str | None = None


class ScanAcceptedContainer(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    description: str = Field(default="", max_length=10000)
    parent_id: int | None = Field(default=None, gt=0)
    proposed_parent_index: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_parent(self):
        if self.parent_id is not None and self.proposed_parent_index is not None:
            raise ValueError("Choose one parent for each container.")
        return self


class ScanAcceptedItem(BaseModel):
    name: str
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    notes: str = ""
    confidence_score: float | None = None
    bbox: list[float] | None = None
    container_id: int | None = Field(default=None, gt=0)
    proposed_container_index: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_destination(self):
        if self.container_id is not None and self.proposed_container_index is not None:
            raise ValueError("Choose one container for each item.")
        return self


class ScanAcceptRequest(BaseModel):
    room_id: int | None = Field(default=None, gt=0)
    expected_revision: str | None = None
    containers: list[ScanAcceptedContainer] = Field(default_factory=list, max_length=100)
    items: list[ScanAcceptedItem] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def validate_selection(self):
        if not self.containers and not self.items:
            raise ValueError("Select at least one item or container to save.")
        return self


class ScanAcceptResponse(BaseModel):
    scan_session_id: str
    status: str = "filed"
    item_ids: list[int]
    container_ids: list[int]
    already_filed: bool = False


class ScanRequest(BaseModel):
    """Expected structured output from the AI vision model."""
    proposed_containers: list[AIContainer] = []
    items: list[AIItem] = []


class FailedScanRead(BaseModel):
    """A scan session that failed AI analysis — retained for review and retry."""
    scan_session_id: str
    room_id: int
    room_name: str
    house_id: int
    house_name: str
    container_id: int | None
    container_name: str | None
    status: str
    image_url: str | None
    error: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}
