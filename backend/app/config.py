from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
import os
import logging
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Database: set DATABASE_URL to Neon Postgres connection string for production;
    # leave unset for local SQLite (default below).
    database_url: str = "sqlite:///./data/diatrack.db"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

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

    @property
    def sync_database_url(self) -> str:
        """URL for sync SQLAlchemy engine (psycopg2 for Postgres, sqlite for local)."""
        url = self.database_url
        if url.startswith("postgresql://") or url.startswith("postgresql+psycopg2://"):
            return url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    @property
    def async_database_url(self) -> str:
        """URL for async SQLAlchemy engine (asyncpg for Postgres, aiosqlite for local)."""
        url = self.database_url
        if "postgresql" in url:
            parsed = urlparse(url)
            # asyncpg only accepts 'ssl' (not sslmode, channel_binding, etc.); keep query minimal
            if parsed.query:
                orig = parse_qs(parsed.query, keep_blank_values=True)
                ssl_val = (orig.get("sslmode") or orig.get("ssl") or [None])[0]
                q = {"ssl": [ssl_val]} if ssl_val else {}
                query = urlencode(q, doseq=True)
            else:
                query = ""
            netloc = parsed.netloc
            path = parsed.path or "/"
            scheme = "postgresql+asyncpg"
            return urlunparse((scheme, netloc, path, parsed.params, query, parsed.fragment))
        if url.startswith("sqlite:///"):
            return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        return url


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    # Only ensure data directory exists when using SQLite (for local dev)
    if "sqlite" in settings.database_url:
        os.makedirs(settings.data_dir, exist_ok=True)
    return settings
