import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class FailureReason(str, enum.Enum):
    CLOGGED = "clogged"  # Verstopft (Katheter)
    FELL_OFF = "fell_off"  # Abgefallen / Pflaster löst sich
    SENSOR_ERROR = "sensor_error"  # Sensor-Fehler / Keine Werte
    SKIN_REACTION = "skin_reaction"  # Hautreaktion / Rötung
    OTHER = "other"  # Sonstiges


# German labels for failure reasons
FAILURE_REASON_LABELS = {
    FailureReason.CLOGGED: "Verstopft",
    FailureReason.FELL_OFF: "Abgefallen / Pflaster löst sich",
    FailureReason.SENSOR_ERROR: "Sensor-Fehler / Keine Werte",
    FailureReason.SKIN_REACTION: "Hautreaktion / Rötung",
    FailureReason.OTHER: "Sonstiges",
}


class FailureLog(Base):
    __tablename__ = "failure_logs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), unique=True, nullable=False)
    reason = Column(Enum(FailureReason), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    device = relationship("Device", back_populates="failure_log")
