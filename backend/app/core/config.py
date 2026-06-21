"""Application configuration loaded and validated from the environment."""

from __future__ import annotations

import platform
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly typed runtime settings.

    Values are read from environment variables (and an optional ``.env`` file).
    Validation happens at startup so misconfiguration fails fast.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000

    database_url: str = "sqlite:///./rayzek.db"
    frontend_origin: str = "http://localhost:5173"

    connection_poll_interval: float = Field(default=1.0, ge=0.25, le=60.0)
    start_collector_automatically: bool = True

    destination_cache_ttl_hours: int = Field(default=168, ge=0)
    geolocation_enabled: bool = True
    hostname_resolution_enabled: bool = True
    geo_provider_url: str = ""
    geo_provider_api_key: str = ""
    geo_request_timeout: float = Field(default=4.0, ge=0.5, le=30.0)

    origin_latitude: float = 37.7749
    origin_longitude: float = -122.4194

    map_style_url: str = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

    rayzek_demo_mode: bool = False

    tshark_enabled: bool = False
    tshark_path: str = ""
    tshark_interface: str = ""

    log_level: str = "INFO"
    retention_days: int = Field(default=30, ge=0)

    @field_validator("log_level")
    @classmethod
    def _normalise_log_level(cls, value: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = value.upper()
        if upper not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {sorted(allowed)}")
        return upper

    @property
    def platform_name(self) -> str:
        return platform.system()  # 'Windows', 'Linux', 'Darwin'

    @property
    def cors_origins(self) -> list[str]:
        # Allow the configured origin plus the loopback variant.
        origins = {self.frontend_origin, "http://127.0.0.1:5173"}
        return sorted(o for o in origins if o)


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (single source of truth)."""
    return Settings()
