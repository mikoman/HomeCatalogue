"""Pydantic schemas for scan/scan-result requests and responses."""

from datetime import datetime
from pydantic import BaseModel


class AIContainer(BaseModel):
    name: str
    description: str = ""


class AIItem(BaseModel):
    name: str
    category: str | None = None
    tags: list[str] = []
    suggested_container: str | None = None
    confidence_score: float = 1.0
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
    status: str  # pending | processing | completed | failed
    image_url: str | None = None
    result: ScanResult | None = None
    error: str | None = None


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
