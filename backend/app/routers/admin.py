from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.app_settings import AppSettings, get_app_settings
from app.models.email_log import EmailLog, EmailStatus, EMAIL_STATUS_LABELS
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
    
    success = send_email(
        request.email,
        "DiaTrack: SMTP Test",
        html_content,
        settings,
        email_type="smtp_test",
        db=db,
    )

    if success:
        return {"message": "Test email sent successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send test email",
        )


# ---------------------------------------------------------------------------
# Email logs
# ---------------------------------------------------------------------------

class EmailLogEntry(BaseModel):
    id: int
    to_email: str
    subject: str
    status: str
    status_label: str
    email_type: str
    error_message: Optional[str] = None
    duration_ms: Optional[int] = None
    smtp_host: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmailLogsResponse(BaseModel):
    total: int
    entries: List[EmailLogEntry]


@router.get("/email-logs", response_model=EmailLogsResponse)
def list_email_logs(
    current_user: User = Depends(current_superuser),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    """Return paginated email operation history. Superuser only."""
    query = db.query(EmailLog)
    if status_filter:
        try:
            query = query.filter(EmailLog.status == EmailStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status filter")

    total = query.count()
    rows = (
        query.order_by(EmailLog.created_at.desc(), EmailLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    entries = [
        EmailLogEntry(
            id=row.id,
            to_email=row.to_email,
            subject=row.subject,
            status=row.status.value if hasattr(row.status, "value") else str(row.status),
            status_label=EMAIL_STATUS_LABELS.get(row.status, str(row.status)),
            email_type=row.email_type,
            error_message=row.error_message,
            duration_ms=row.duration_ms,
            smtp_host=row.smtp_host,
            created_at=row.created_at,
        )
        for row in rows
    ]
    return EmailLogsResponse(total=total, entries=entries)


@router.delete("/email-logs", status_code=status.HTTP_204_NO_CONTENT)
def clear_email_logs(
    current_user: User = Depends(current_superuser),
    db: Session = Depends(get_db),
):
    """Remove all email log entries. Superuser only."""
    db.query(EmailLog).delete()
    db.commit()
