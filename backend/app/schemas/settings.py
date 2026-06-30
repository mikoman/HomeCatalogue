"""Pydantic schemas for AI settings."""

from pydantic import BaseModel, Field


LOCAL_PROVIDERS = ("ollama", "lmstudio")


class AISettingsRead(BaseModel):
    provider: str
    base_url: str
    model: str
    embedding_model: str = ""
    ollama_base_url: str
    ollama_model: str
    ollama_embedding_model: str = ""
    lmstudio_base_url: str
    lmstudio_model: str
    lmstudio_embedding_model: str = ""
    box_source: str = "off"
    detector_enabled: bool = False  # legacy mirror of box_source == 'yolo'
    detector_base_url: str = ""
    running_in_docker: bool
    suggested_urls: dict[str, str]
    suggested_urls_by_provider: dict[str, dict[str, str]]


class AISettingsUpdate(BaseModel):
    provider: str = Field(..., pattern="^(ollama|lmstudio)$")
    base_url: str
    model: str
    embedding_model: str | None = None


class DetectorSettingsUpdate(BaseModel):
    """Bounding-box source toggle + detector sidecar URL (YOLO-World only)."""
    box_source: str = Field(..., pattern="^(off|yolo|vlm)$")
    base_url: str = ""


class AIModelInfo(BaseModel):
    id: str
    name: str


class AIModelsResponse(BaseModel):
    provider: str
    base_url: str
    models: list[AIModelInfo]
    error: str | None = None


class AIConnectionTest(BaseModel):
    provider: str
    base_url: str
    ok: bool
    message: str
    latency_ms: int
    model_count: int
    running_in_docker: bool
