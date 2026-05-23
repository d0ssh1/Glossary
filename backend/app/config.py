"""Application configuration loaded from env or defaults."""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration."""

    model_config = SettingsConfigDict(env_prefix="LW_", env_file=".env", extra="ignore")

    # Project root (directory containing this file's grandparent).
    project_root: Path = Path(__file__).resolve().parent.parent

    # SQLite database file path (overridable via env LW_DATABASE_URL).
    database_url: str = "sqlite:///./lexicon_weaver.db"

    # Comma-separated list of origins allowed by CORS.
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000"

    # Stepik mock-data directory for offline import.
    mock_data_dir: Path = Path(__file__).resolve().parent.parent / "mock_data"

    # Stepik OAuth client credentials (optional — JSON-dump fallback if absent).
    stepik_client_id: str = ""
    stepik_client_secret: str = ""
    stepik_api_base: str = "https://stepik.org/api"
    stepik_oauth_url: str = "https://stepik.org/oauth2/token/"


settings = Settings()
