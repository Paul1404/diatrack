# Stage 1: Build frontend with Bun (much faster than npm)
FROM oven/bun:1-alpine AS frontend-builder

WORKDIR /app/frontend

# Install deps first (cached layer when only source changes).
# --frozen-lockfile means the build fails fast if bun.lock is stale.
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

# Stage 2: Build final image
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ .

# Copy built frontend to static directory
COPY --from=frontend-builder /app/frontend/dist ./static

# Create non-root user (no volume needed when using Neon)
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Railway injects PORT; use it when set, else default to 8000 for Docker Compose / Fly
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips '*'"]
