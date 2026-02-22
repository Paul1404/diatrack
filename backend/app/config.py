from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
import os
import logging

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Database (SQLite by default)
    database_url: str = "sqlite:///./data/diatrack.db"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480  # 8 hours (was 7 days)

    # Separate secrets for reset/verification tokens (fall back to jwt_secret if not set)
    reset_token_secret: str = ""
    verification_token_secret: str = ""

    # Data directory
    data_dir: str = "./data"
    
    # Registration (disabled by default for security)
    allow_registration: bool = False

    # CORS allowed origins (comma-separated)
    cors_origins: str = "https://diatrack.pdcd.net"

    # Cookie secure flag (set to false for local dev over HTTP)
    cookie_secure: bool = True

    @field_validator("jwt_secret")
    @classmethod
    def jwt_secret_must_be_changed(cls, v: str) -> str:
        if v == "change-me-in-production":
            raise ValueError(
                "JWT_SECRET is still the default value. "
                "Set the JWT_SECRET environment variable to a strong random string."
            )
        return v

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    # Ensure data directory exists
    os.makedirs(settings.data_dir, exist_ok=True)
    return settings
