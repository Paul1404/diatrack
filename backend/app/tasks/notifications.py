import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from jinja2 import Template
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import logging
from app.config import get_settings
from app.models.user import User
from app.models.device import Device, DeviceStatus, DeviceType, BODY_LOCATION_LABELS
from app.models.app_settings import get_app_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Create separate engine for background tasks
connect_args = {"check_same_thread": False} if "sqlite" in settings.database_url else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

EMAIL_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0052CC; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #F4F5F7; padding: 20px; border-radius: 0 0 8px 8px; }
        .device-card { background: white; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid {{ color }}; }
        .device-type { font-weight: bold; color: #172B4D; }
        .location { color: #6B778C; }
        .time-remaining { font-size: 18px; color: {{ color }}; font-weight: bold; }
        .cta { display: inline-block; background: #0052CC; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0;">DiaTrack Erinnerung</h1>
        </div>
        <div class="content">
            <p>Hallo,</p>
            <p>Dein {{ device_type_label }} läuft bald ab:</p>
            
            <div class="device-card">
                <div class="device-type">{{ device_type_label }}</div>
                <div class="location">{{ body_location }}</div>
                <div class="time-remaining">Noch ca. {{ hours_remaining }} Stunden</div>
                <p style="margin: 5px 0; color: #6B778C;">Gestartet: {{ start_time }}</p>
            </div>
            
            <p>Bitte plane den Wechsel rechtzeitig ein.</p>
            
            <a href="{{ app_url }}" class="cta">Dashboard öffnen</a>
            
            <p style="margin-top: 20px; color: #6B778C; font-size: 12px;">
                Diese E-Mail wurde automatisch von DiaTrack gesendet.
            </p>
        </div>
    </div>
</body>
</html>
"""


def send_email(to_email: str, subject: str, html_content: str, app_settings) -> bool:
    """Send an email using SMTP settings from database."""
    if not app_settings.smtp_host or not app_settings.smtp_from:
        logger.debug("SMTP not configured, skipping email to %s", to_email)
        return False

    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = app_settings.smtp_from
        message["To"] = to_email

        html_part = MIMEText(html_content, "html")
        message.attach(html_part)

        if app_settings.smtp_tls:
            context = ssl.create_default_context()
            with smtplib.SMTP(app_settings.smtp_host, app_settings.smtp_port) as server:
                server.starttls(context=context)
                if app_settings.smtp_user and app_settings.smtp_password:
                    server.login(app_settings.smtp_user, app_settings.smtp_password)
                server.sendmail(app_settings.smtp_from, to_email, message.as_string())
        else:
            with smtplib.SMTP(app_settings.smtp_host, app_settings.smtp_port) as server:
                if app_settings.smtp_user and app_settings.smtp_password:
                    server.login(app_settings.smtp_user, app_settings.smtp_password)
                server.sendmail(app_settings.smtp_from, to_email, message.as_string())

        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False


def send_device_reminder(device: Device, user: User, app_settings):
    """Send a reminder email for a specific device."""
    now = datetime.now(timezone.utc)
    start = device.start_time.replace(tzinfo=timezone.utc) if device.start_time.tzinfo is None else device.start_time
    end_time = start + timedelta(hours=device.planned_duration_hours)
    hours_remaining = max(0, (end_time - now).total_seconds() / 3600)

    # Determine color based on urgency
    if hours_remaining <= 6:
        color = "#DE350B"  # Red
    elif hours_remaining <= 24:
        color = "#FF991F"  # Orange
    else:
        color = "#00875A"  # Green

    device_type_label = "Sensor" if device.device_type == DeviceType.SENSOR else "Katheter"
    body_location = BODY_LOCATION_LABELS.get(device.body_location, str(device.body_location))

    template = Template(EMAIL_TEMPLATE)
    html_content = template.render(
        device_type_label=device_type_label,
        body_location=body_location,
        hours_remaining=round(hours_remaining),
        start_time=device.start_time.strftime("%d.%m.%Y %H:%M"),
        color=color,
        app_url=app_settings.app_url,
    )

    subject = f"DiaTrack: {device_type_label} läuft in ca. {round(hours_remaining)} Stunden ab"
    send_email(user.email, subject, html_content, app_settings)


def check_expiring_devices():
    """Check for devices that need reminder notifications."""
    db = SessionLocal()
    try:
        app_settings = get_app_settings(db)
        
        # Get all active devices
        active_devices = (
            db.query(Device)
            .filter(Device.status == DeviceStatus.ACTIVE)
            .all()
        )

        now = datetime.now(timezone.utc)

        for device in active_devices:
            user = db.query(User).filter(User.id == device.user_id).first()
            if not user:
                continue

            reminder_intervals = user.settings.get("reminder_intervals_hours", [24, 6])
            start = device.start_time.replace(tzinfo=timezone.utc) if device.start_time.tzinfo is None else device.start_time
            end_time = start + timedelta(hours=device.planned_duration_hours)
            hours_remaining = (end_time - now).total_seconds() / 3600

            # Check each reminder interval
            for interval in reminder_intervals:
                reminder_key = f"{interval}h"

                # Skip if already sent
                if reminder_key in device.reminders_sent:
                    continue

                # Send if within the interval window (e.g., between 24h and 23.75h)
                if interval - 0.25 <= hours_remaining <= interval + 0.25:
                    send_device_reminder(device, user, app_settings)

                    # Mark reminder as sent
                    if device.reminders_sent:
                        device.reminders_sent += f",{reminder_key}"
                    else:
                        device.reminders_sent = reminder_key
                    db.commit()

        logger.info("Checked %d active devices for reminders", len(active_devices))

    except Exception as e:
        logger.error("Error checking expiring devices: %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()
