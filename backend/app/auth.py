from typing import AsyncGenerator, Optional
from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, IntegerIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import Session
import logging

from app.config import get_settings
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
settings = get_settings()

# Async engine for FastAPI-Users (asyncpg for Postgres, aiosqlite for SQLite)
# Serverless-tuned: small pool, aggressive recycle to handle Neon cold starts
_async_pool_kwargs: dict = {"pool_pre_ping": True}
if "postgresql" in settings.database_url:
    _async_pool_kwargs.update(pool_size=3, max_overflow=5, pool_recycle=300, pool_timeout=30)
async_engine = create_async_engine(settings.async_database_url, **_async_pool_kwargs)
async_session_maker = async_sessionmaker(async_engine, expire_on_commit=False)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, User)


class UserManager(IntegerIDMixin, BaseUserManager[User, int]):
    reset_password_token_secret = settings.reset_token_secret or settings.jwt_secret
    verification_token_secret = settings.verification_token_secret or settings.jwt_secret

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        logger.info("User %d (%s) has registered.", user.id, user.email)

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        logger.info("User %d requested password reset.", user.id)
        # Token is NOT logged — it will be sent via email

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        logger.info("User %d requested email verification.", user.id)
        # Token is NOT logged — it will be sent via email


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


# Cookie transport for browser sessions
cookie_transport = CookieTransport(
    cookie_name="diatrack_session",
    cookie_max_age=settings.jwt_expire_minutes * 60,
    cookie_secure=settings.cookie_secure,
    cookie_httponly=True,
    cookie_samesite="lax",
)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.jwt_secret,
        lifetime_seconds=settings.jwt_expire_minutes * 60,
    )


auth_backend = AuthenticationBackend(
    name="cookie",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, int](get_user_manager, [auth_backend])

# Dependencies for routes
current_active_user = fastapi_users.current_user(active=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)


# Sync dependency for existing routes (bridges async FastAPI-Users with sync SQLAlchemy)
async def get_current_user(user: User = Depends(current_active_user)) -> User:
    """Get current authenticated user - async wrapper for FastAPI-Users."""
    return user
