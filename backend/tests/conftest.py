import os

# app.config validates settings at import time (e.g. JWT_SECRET must not be the
# default), so these have to be set before any application module is imported.
# setdefault means a real CI/dev environment can still override them.
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")
os.environ.setdefault("DATABASE_URL", "sqlite:///./data/test.db")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:8000")
