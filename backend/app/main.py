from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from contextlib import asynccontextmanager
import os
import logging
import time
import asyncio
import sqlalchemy as sa
from app.config import get_settings
from app.database import engine, Base, SessionLocal
from app.routers import auth_router, devices_router, stats_router, admin_router
from app.models import User, Device, FailureLog, AppSettings, EmailLog  # Import models to register them
from app.tasks import start_scheduler, stop_scheduler
from app.auth import async_engine

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("diatrack")

settings = get_settings()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


class AccessLogMiddleware(BaseHTTPMiddleware):
    """Log all requests with method, path, status, and duration."""
    async def dispatch(self, request: Request, call_next):
        start_time = time.monotonic()
        response: Response = await call_next(request)
        duration_ms = (time.monotonic() - start_time) * 1000
        # Skip logging static asset requests to reduce noise
        if not request.url.path.startswith("/assets"):
            logger.info(
                "%s %s %d %.0fms",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )
        return response


# Simple in-memory rate limiter for auth endpoints
_rate_limit_store: dict[str, list[float]] = {}
RATE_LIMIT_PATHS = {"/api/auth/login", "/api/auth/register", "/api/auth/forgot-password"}
RATE_LIMIT_MAX = 5       # max requests
RATE_LIMIT_WINDOW = 60   # per 60 seconds


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate-limit sensitive auth endpoints by client IP."""
    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" and request.url.path in RATE_LIMIT_PATHS:
            client_ip = request.client.host if request.client else "unknown"
            key = f"{client_ip}:{request.url.path}"
            now = time.monotonic()

            # Clean old entries and check count
            timestamps = _rate_limit_store.get(key, [])
            timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]

            if len(timestamps) >= RATE_LIMIT_MAX:
                from fastapi.responses import JSONResponse
                logger.warning("Rate limit exceeded for %s on %s", client_ip, request.url.path)
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                )

            timestamps.append(now)
            _rate_limit_store[key] = timestamps

        return await call_next(request)


def _wait_for_db_sync(max_attempts: int = 10, base_delay: float = 2.0):
    """Retry DB operations until the database is ready (handles Postgres cold start)."""
    import sqlalchemy.exc
    last_err = None
    for attempt in range(max_attempts):
        try:
            with engine.connect() as conn:
                conn.execute(sa.text("SELECT 1"))
            return
        except (sqlalchemy.exc.OperationalError, Exception) as e:
            last_err = e
            if attempt < max_attempts - 1:
                delay = base_delay * (2**attempt)
                logger.warning(
                    "Database not ready (attempt %d/%d): %s. Retrying in %.1fs...",
                    attempt + 1, max_attempts, e, delay,
                )
                time.sleep(delay)
    raise last_err


async def _wait_for_db_async(max_attempts: int = 10, base_delay: float = 2.0):
    """Retry async DB operations until the database is ready."""
    import sqlalchemy.exc
    last_err = None
    for attempt in range(max_attempts):
        try:
            async with async_engine.connect() as conn:
                await conn.execute(sa.text("SELECT 1"))
            return
        except (sqlalchemy.exc.OperationalError, Exception) as e:
            last_err = e
            if attempt < max_attempts - 1:
                delay = base_delay * (2**attempt)
                logger.warning(
                    "Database not ready (attempt %d/%d): %s. Retrying in %.1fs...",
                    attempt + 1, max_attempts, e, delay,
                )
                await asyncio.sleep(delay)
    raise last_err


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Wait for database to be ready (Postgres may still be starting on Railway)
    if "postgresql" in settings.database_url:
        _wait_for_db_sync()
        await _wait_for_db_async()

    # Enable WAL mode for SQLite — better concurrency (reads don't block writes)
    if "sqlite" in settings.database_url:
        with engine.connect() as conn:
            conn.execute(sa.text("PRAGMA journal_mode=WAL"))
            conn.execute(sa.text("PRAGMA busy_timeout=5000"))
            conn.commit()
        logger.info("SQLite WAL mode enabled")

    # Create tables on startup (sync engine for existing models)
    Base.metadata.create_all(bind=engine)
    # Also create with async engine for FastAPI-Users
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Start background scheduler
    start_scheduler()
    logger.info("DiaTrack started")
    yield
    # Graceful shutdown
    stop_scheduler()
    engine.dispose()
    await async_engine.dispose()
    logger.info("DiaTrack shutdown complete")


app = FastAPI(
    title="DiaTrack API",
    description="API for tracking diabetes hardware (sensors and catheters)",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None,       # Disable Swagger UI in production
    redoc_url=None,       # Disable ReDoc in production
    openapi_url=None,     # Disable OpenAPI schema in production
)

# Rate limiting middleware (must be before other middlewares in the stack)
app.add_middleware(RateLimitMiddleware)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Access log middleware
app.add_middleware(AccessLogMiddleware)

# CORS middleware — restrict to configured origins
cors_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

# Global handler: surface transient DB errors as 503 (Service Unavailable) so the
# frontend can detect cold-start failures and retry automatically.
from sqlalchemy.exc import OperationalError as _SAOperationalError, DisconnectionError as _SADisconnectionError

@app.exception_handler(_SAOperationalError)
@app.exception_handler(_SADisconnectionError)
async def _db_transient_error_handler(request: Request, exc: Exception):
    logger.warning("Database unavailable for %s %s: %s", request.method, request.url.path, exc)
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=503,
        content={"detail": "Database temporarily unavailable — please retry in a moment."},
        headers={"Retry-After": "2"},
    )


# Catch-all for anything unexpected: log the full trace server-side, but return
# a clean JSON 500 so we never leak stack traces or internals to the client.
# More specific handlers above (and FastAPI's HTTPException handler) take
# precedence, so normal 4xx responses are unaffected.
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# Include routers
app.include_router(auth_router)
app.include_router(devices_router)
app.include_router(stats_router)
app.include_router(admin_router)


@app.get("/api/health")
def health_check():
    """Health check endpoint — verifies database connectivity."""
    try:
        db = SessionLocal()
        db.execute(sa.text("SELECT 1"))
        db.close()
        return {"status": "healthy", "service": "diatrack-api"}
    except Exception as e:
        logger.error("Health check failed: %s", e)
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "service": "diatrack-api", "error": str(e)},
        )


@app.get("/api/enums/body-locations")
def get_body_locations():
    """Get available body locations."""
    from app.models.device import BodyLocation, BODY_LOCATION_LABELS
    return [
        {"value": loc.value, "label": BODY_LOCATION_LABELS[loc]}
        for loc in BodyLocation
    ]


@app.get("/api/enums/failure-reasons")
def get_failure_reasons():
    """Get available failure reasons."""
    from app.models.failure_log import FailureReason, FAILURE_REASON_LABELS
    return [
        {"value": reason.value, "label": FAILURE_REASON_LABELS[reason]}
        for reason in FailureReason
    ]


@app.get("/api/enums/device-types")
def get_device_types():
    """Get available device types."""
    return [
        {"value": "sensor", "label": "Sensor"},
        {"value": "catheter", "label": "Katheter"},
    ]


# Serve frontend static files
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    @app.get("/favicon.svg")
    async def serve_favicon_svg():
        path = os.path.join(static_dir, "favicon.svg")
        if os.path.exists(path):
            return FileResponse(path, media_type="image/svg+xml")
        return Response(status_code=404)

    @app.get("/favicon.ico")
    async def serve_favicon_ico():
        path = os.path.join(static_dir, "favicon.ico")
        if os.path.exists(path):
            return FileResponse(path, media_type="image/x-icon")
        return Response(status_code=404)

    @app.get("/apple-touch-icon.png")
    async def serve_apple_touch_icon():
        path = os.path.join(static_dir, "apple-touch-icon.png")
        if os.path.exists(path):
            return FileResponse(path, media_type="image/png")
        return Response(status_code=404)

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all non-API routes."""
        if full_path.startswith("api/"):
            return {"detail": "Not Found"}
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"detail": "Frontend not built"}
