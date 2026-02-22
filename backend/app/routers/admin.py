from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.models.app_settings import AppSettings, get_app_settings
from app.auth import get_current_user, current_superuser

router = APIRouter(prefix="/api/admin", tags=["Admin Settings"])


class AppSettingsResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_from: str
    smtp_tls: bool
    app_url: str

    class Config:
        from_attributes = True


class AppSettingsUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_tls: Optional[bool] = None
    app_url: Optional[str] = None


class SmtpTestRequest(BaseModel):
    email: str


@router.get("/settings", response_model=AppSettingsResponse)
def get_settings(
    current_user: User = Depends(current_superuser),
    db: Session = Depends(get_db),
):
    """Get application settings. Requires superuser."""
    settings = get_app_settings(db)
    return settings


@router.put("/settings", response_model=AppSettingsResponse)
def update_settings(
    settings_update: AppSettingsUpdate,
    current_user: User = Depends(current_superuser),
    db: Session = Depends(get_db),
):
    """Update application settings."""
    settings = get_app_settings(db)

    if settings_update.smtp_host is not None:
        settings.smtp_host = settings_update.smtp_host
    if settings_update.smtp_port is not None:
        settings.smtp_port = settings_update.smtp_port
    if settings_update.smtp_user is not None:
        settings.smtp_user = settings_update.smtp_user
    if settings_update.smtp_password is not None:
        settings.smtp_password = settings_update.smtp_password
    if settings_update.smtp_from is not None:
        settings.smtp_from = settings_update.smtp_from
    if settings_update.smtp_tls is not None:
        settings.smtp_tls = settings_update.smtp_tls
    if settings_update.app_url is not None:
        settings.app_url = settings_update.app_url

    db.commit()
    db.refresh(settings)

    return settings


@router.post("/settings/test-smtp")
def test_smtp(
    request: SmtpTestRequest,
    current_user: User = Depends(current_superuser),
    db: Session = Depends(get_db),
):
    """Send a test email to verify SMTP settings."""
    from app.tasks.notifications import send_email
    
    settings = get_app_settings(db)
    
    if not settings.smtp_host or not settings.smtp_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP settings not configured",
        )
    
    html_content = """
    <html>
    <body>
        <h1>DiaTrack Test-E-Mail</h1>
        <p>Diese E-Mail bestätigt, dass die SMTP-Einstellungen korrekt konfiguriert sind.</p>
    </body>
    </html>
    """
    
    success = send_email(request.email, "DiaTrack: SMTP Test", html_content, settings)
    
    if success:
        return {"message": "Test email sent successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send test email",
        )
