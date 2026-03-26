import time
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.exc import OperationalError, DisconnectionError
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# SQLite-specific settings; Postgres (Neon) uses sync_database_url with no connect_args
connect_args = {"check_same_thread": False} if "sqlite" in settings.database_url else {}

# Serverless-tuned pool settings for Neon: connections can be terminated at any time
# when the compute scales to zero, so we recycle aggressively and keep the pool small.
pool_kwargs = {"pool_pre_ping": True}
if "postgresql" in settings.database_url:
    pool_kwargs.update(
        pool_size=3,
        max_overflow=5,
        pool_recycle=300,       # Recycle connections every 5 min (Neon idles at ~5 min)
        pool_timeout=30,
    )

engine = create_engine(settings.sync_database_url, connect_args=connect_args, **pool_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Max retries / backoff for transient serverless DB errors (cold start, connection reset)
DB_RETRY_ATTEMPTS = 3
DB_RETRY_BASE_DELAY = 0.5  # seconds


def _is_transient_error(exc: Exception) -> bool:
    """Return True if the error looks like a serverless cold-start / connection drop."""
    if isinstance(exc, (OperationalError, DisconnectionError)):
        return True
    msg = str(exc).lower()
    return any(
        keyword in msg
        for keyword in ("connection reset", "connection refused", "broken pipe",
                        "server closed", "ssl connection", "could not connect",
                        "timeout", "can't reach database")
    )


def get_db():
    """FastAPI dependency that yields a DB session with automatic retry on transient errors.

    On the first request after a Neon cold start the connection may fail.  We
    transparently retry with short exponential backoff so the caller never sees
    a 500 for a simple wake-up delay.
    """
    last_err: Exception | None = None
    for attempt in range(DB_RETRY_ATTEMPTS):
        db: Session = SessionLocal()
        try:
            # Validate the connection is alive before handing it to the route
            db.execute(__import__("sqlalchemy").text("SELECT 1"))
            yield db
            return
        except Exception as exc:
            db.close()
            if attempt < DB_RETRY_ATTEMPTS - 1 and _is_transient_error(exc):
                delay = DB_RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "Transient DB error (attempt %d/%d): %s — retrying in %.1fs",
                    attempt + 1, DB_RETRY_ATTEMPTS, exc, delay,
                )
                time.sleep(delay)
                last_err = exc
            else:
                raise
        finally:
            db.close()

    # Should not be reached, but just in case
    if last_err:
        raise last_err
