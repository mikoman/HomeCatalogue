"""Pydantic schemas for scan/scan-result requests and responses."""

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


class ScanResult(BaseModel):
    proposed_containers: list[AIContainer] = []
    items: list[AIItem] = []


class ScanRequest(BaseModel):
    """Expected structured output from the AI vision model."""
    proposed_containers: list[AIContainer] = []
    items: list[AIItem] = []
