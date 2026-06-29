"""Application configuration loaded from environment variables."""

import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # AI Provider
    ai_provider: str = os.getenv("AI_PROVIDER", "openai")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llava")
    omlx_model: str = os.getenv("OMLX_MODEL", "mlx-community/llava-1.5-7b-4bit")

    # Server
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    cors_origins_raw: str = os.getenv("CORS_ORIGINS", "http://localhost:5173")

    # Database
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./home_catalogue.db")

    # Storage
    upload_dir: str = os.getenv("UPLOAD_DIR", "/app/storage/uploads")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
