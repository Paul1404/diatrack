from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.device import DeviceType, DeviceStatus, BodyLocation
from app.models.failure_log import FailureReason


class DeviceCreate(BaseModel):
    device_type: DeviceType
    body_location: BodyLocation
    start_time: Optional[datetime] = None  # If None, use current time
    planned_duration_hours: Optional[float] = None  # If None, use user defaults


class DeviceResponse(BaseModel):
    id: int
    device_type: DeviceType
    body_location: BodyLocation
    body_location_label: str
    start_time: datetime
    planned_duration_hours: float
    status: DeviceStatus
    ended_at: Optional[datetime]
    created_at: datetime
    remaining_hours: Optional[float]
    progress_percent: Optional[float]
    failure_reason: Optional[FailureReason] = None
    failure_notes: Optional[str] = None

    class Config:
        from_attributes = True


class DeviceUpdate(BaseModel):
    start_time: Optional[datetime] = None


class DeviceEndRequest(BaseModel):
    pass  # No body needed, just mark as completed


class DeviceFailureRequest(BaseModel):
    reason: FailureReason
    notes: Optional[str] = Field(None, max_length=2000)
    failed_at: Optional[datetime] = None  # If None, use current time


class FailureLogResponse(BaseModel):
    id: int
    device_id: int
    reason: FailureReason
    reason_label: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
