"""Application configuration loaded from environment variables."""

import os
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # AI Provider
    ai_provider: str = os.getenv("AI_PROVIDER", "ollama")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-3.8-flash"
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-flash"
    scan_max_tokens: int = Field(default=4096, ge=256, le=32768)
    ollama_num_ctx: int = Field(default=8192, ge=2048, le=131072)
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen3.5:9b")
    lmstudio_base_url: str = os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234/v1")
    lmstudio_model: str = os.getenv("LMSTUDIO_MODEL", "")
    omlx_model: str = os.getenv("OMLX_MODEL", "mlx-community/llava-1.5-7b-4bit")
    # oMLX runs on the host; from inside Docker reach it via host.docker.internal
    omlx_base_url: str = os.getenv("OMLX_BASE_URL", "http://host.docker.internal:8000/v1")
    omlx_api_key: str = os.getenv("OMLX_API_KEY", "")

    # Object detector sidecar (YOLO-World) — localizes scanned items into boxes.
    # Runs on the host (GPU/MPS); the Docker backend reaches it via host.docker.internal.
    detector_base_url: str = os.getenv("DETECTOR_BASE_URL", "http://host.docker.internal:8077")
    # Speed lever: cap the longest edge of the image sent to the model(s).
    scan_max_edge: int = int(os.getenv("SCAN_MAX_EDGE", "1280"))

    # Server
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    cors_origins_raw: str = Field(default="http://localhost:5173", validation_alias="CORS_ORIGINS")

    # Database
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./home_catalogue.db")

    # Storage
    upload_dir: str = os.getenv("UPLOAD_DIR", "/app/storage/uploads")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
