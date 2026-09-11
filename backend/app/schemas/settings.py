"""Pydantic schemas for AI settings."""

from typing import Literal

from pydantic import BaseModel, Field, SecretStr


Provider = Literal["ollama", "lmstudio", "omlx", "openrouter", "deepseek", "openai", "anthropic"]


class DeepSeekSettings(BaseModel):
    image_detail: Literal["original", "low", "high", "auto"] = "original"
    thinking: Literal["disabled", "enabled"] = "disabled"
    reasoning_effort: Literal["low", "high", "max"] = "high"
    max_tokens: int = Field(default=8192, ge=256, le=393216)


class ProviderSettingsRead(BaseModel):
    base_url: str
    model: str
    embedding_model: str = ""
    api_key_configured: bool
    api_key_source: Literal["saved", "environment", "none"]
    environment_key_available: bool
    deepseek: DeepSeekSettings | None = None


class ScanSettings(BaseModel):
    scan_max_tokens: int = Field(default=4096, ge=256, le=32768)
    ollama_num_ctx: int = Field(default=8192, ge=2048, le=131072)
    scan_max_edge: int = Field(default=1280, ge=256, le=4096)


class AISettingsRead(BaseModel):
    providers: dict[str, ProviderSettingsRead]
    scan: ScanSettings
    provider: str
    effective_provider: str
    effective_model: str
    base_url: str
    model: str
    embedding_model: str = ""
    ollama_base_url: str
    ollama_model: str
    ollama_embedding_model: str = ""
    lmstudio_base_url: str
    lmstudio_model: str
    lmstudio_embedding_model: str = ""
    openrouter_base_url: str
    openrouter_model: str
    openrouter_configured: bool = False
    box_source: str = "off"
    detector_enabled: bool = False  # legacy mirror of box_source == 'yolo'
    detector_base_url: str = ""
    running_in_docker: bool
    suggested_urls: dict[str, str]
    suggested_urls_by_provider: dict[str, dict[str, str]]


class AIProviderRequest(BaseModel):
    provider: Provider
    base_url: str | None = None
    api_key: SecretStr | None = Field(default=None, max_length=4096)
    api_key_action: Literal["keep", "replace", "clear", "environment"] = "keep"


class AISettingsUpdate(AIProviderRequest):
    model: str = Field(..., min_length=1, max_length=255)
    embedding_model: str | None = Field(default=None, max_length=255)
    activate: bool = True
    deepseek: DeepSeekSettings | None = None


class DetectorSettingsUpdate(BaseModel):
    """Bounding-box source and the local detector URL."""
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
