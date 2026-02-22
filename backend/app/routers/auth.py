from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserSettings, UserSettingsUpdate, UserRead, UserCreate
from app.auth import fastapi_users, auth_backend, get_current_user
from app.config import get_settings

settings = get_settings()

# FastAPI-Users provides these routers
auth_router = fastapi_users.get_auth_router(auth_backend)
register_router = fastapi_users.get_register_router(UserRead, UserCreate)

# Custom router for user settings
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Include FastAPI-Users auth routes (login/logout)
router.include_router(auth_router, prefix="")

# Include register route only if enabled
if settings.allow_registration:
    router.include_router(register_router, prefix="")


@router.get("/registration-enabled")
def registration_enabled():
    """Check if registration is enabled."""
    return {"enabled": settings.allow_registration}


@router.get("/me", response_model=UserRead)
async def get_me(user: User = Depends(get_current_user)):
    """Get current user info."""
    return user


@router.get("/me/settings", response_model=UserSettings)
async def get_settings(user: User = Depends(get_current_user)):
    """Get current user settings."""
    return UserSettings(**user.settings) if user.settings else UserSettings()


@router.put("/me/settings", response_model=UserSettings)
async def update_settings(
    settings_update: UserSettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user settings."""
    # Fetch user from sync session to allow modifications
    db_user = db.query(User).filter(User.id == user.id).first()
    if not db_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    
    current_settings = db_user.settings.copy() if db_user.settings else {}

    if settings_update.sensor_default_hours is not None:
        current_settings["sensor_default_hours"] = settings_update.sensor_default_hours
    if settings_update.catheter_default_hours is not None:
        current_settings["catheter_default_hours"] = settings_update.catheter_default_hours
    if settings_update.reminder_intervals_hours is not None:
        current_settings["reminder_intervals_hours"] = settings_update.reminder_intervals_hours

    db_user.settings = current_settings
    db.commit()
    db.refresh(db_user)

    return UserSettings(**db_user.settings)
