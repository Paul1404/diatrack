import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, Index
from sqlalchemy.sql import func
from app.database import Base


class EmailStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


EMAIL_STATUS_LABELS = {
    EmailStatus.SUCCESS: "Erfolgreich",
    EmailStatus.FAILED: "Fehlgeschlagen",
    EmailStatus.SKIPPED: "Übersprungen",
}


class EmailLog(Base):
    """Audit log for every email operation (sent, failed, or skipped)."""
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    to_email = Column(String(320), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    status = Column(Enum(EmailStatus), nullable=False, index=True)
    email_type = Column(String(64), nullable=False, default="other")
    error_message = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    smtp_host = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


Index("ix_email_logs_created_status", EmailLog.created_at.desc(), EmailLog.status)
