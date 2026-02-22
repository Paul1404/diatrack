import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Float, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class DeviceType(str, enum.Enum):
    SENSOR = "sensor"
    CATHETER = "catheter"


class DeviceStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"


class BodyLocation(str, enum.Enum):
    ABDOMEN_LEFT = "abdomen_left"
    ABDOMEN_RIGHT = "abdomen_right"
    THIGH_LEFT = "thigh_left"
    THIGH_RIGHT = "thigh_right"
    UPPER_ARM_LEFT = "upper_arm_left"
    UPPER_ARM_RIGHT = "upper_arm_right"
    BUTTOCK_LEFT = "buttock_left"
    BUTTOCK_RIGHT = "buttock_right"
    LOWER_BACK_LEFT = "lower_back_left"
    LOWER_BACK_RIGHT = "lower_back_right"


# German labels for body locations
BODY_LOCATION_LABELS = {
    BodyLocation.ABDOMEN_LEFT: "Bauch links",
    BodyLocation.ABDOMEN_RIGHT: "Bauch rechts",
    BodyLocation.THIGH_LEFT: "Oberschenkel links",
    BodyLocation.THIGH_RIGHT: "Oberschenkel rechts",
    BodyLocation.UPPER_ARM_LEFT: "Oberarm links",
    BodyLocation.UPPER_ARM_RIGHT: "Oberarm rechts",
    BodyLocation.BUTTOCK_LEFT: "Gesäß links",
    BodyLocation.BUTTOCK_RIGHT: "Gesäß rechts",
    BodyLocation.LOWER_BACK_LEFT: "Unterer Rücken links",
    BodyLocation.LOWER_BACK_RIGHT: "Unterer Rücken rechts",
}


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        Index("ix_devices_user_status", "user_id", "status"),
        Index("ix_devices_user_start", "user_id", "start_time"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    device_type = Column(Enum(DeviceType), nullable=False)
    body_location = Column(Enum(BodyLocation), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    planned_duration_hours = Column(Float, nullable=False)
    status = Column(Enum(DeviceStatus), default=DeviceStatus.ACTIVE, nullable=False, index=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Track which reminders have been sent
    reminders_sent = Column(String(255), default="", nullable=False)

    user = relationship("User", back_populates="devices")
    failure_log = relationship(
        "FailureLog", back_populates="device", uselist=False, cascade="all, delete-orphan"
    )
