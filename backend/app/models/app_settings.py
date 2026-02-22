from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base


class AppSettings(Base):
    """Global application settings stored in database."""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)
    
    # SMTP Configuration
    smtp_host = Column(String(255), default="")
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String(255), default="")
    smtp_password = Column(String(255), default="")
    smtp_from = Column(String(255), default="")
    smtp_tls = Column(Boolean, default=True)
    
    # App URL (for email links)
    app_url = Column(String(255), default="https://diatrack.pdcd.net")


def get_app_settings(db) -> AppSettings:
    """Get or create the singleton app settings record."""
    settings = db.query(AppSettings).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings
