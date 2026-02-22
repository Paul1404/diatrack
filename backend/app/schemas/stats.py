from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.models.device import DeviceType, BodyLocation
from app.models.failure_log import FailureReason


class OverviewStats(BaseModel):
    total_devices: int
    active_devices: int
    completed_devices: int
    failed_devices: int
    sensor_failure_rate: float
    catheter_failure_rate: float
    avg_sensor_duration_hours: Optional[float]
    avg_catheter_duration_hours: Optional[float]


class MTBFStats(BaseModel):
    device_type: DeviceType
    mtbf_hours: Optional[float]  # Mean Time Between Failures
    total_failures: int
    total_completed: int


class FailureByReason(BaseModel):
    reason: FailureReason
    reason_label: str
    count: int
    percentage: float


class FailureByLocation(BaseModel):
    body_location: BodyLocation
    body_location_label: str
    total_devices: int
    failed_devices: int
    failure_rate: float


class FailureStats(BaseModel):
    by_reason: List[FailureByReason]
    by_location: List[FailureByLocation]
    by_device_type: List[MTBFStats]


class DurationComparison(BaseModel):
    device_type: DeviceType
    planned_hours: float
    actual_hours: float
    difference_hours: float
    date: datetime


class HistoryEntry(BaseModel):
    id: int
    device_type: DeviceType
    body_location: BodyLocation
    body_location_label: str
    start_time: datetime
    ended_at: Optional[datetime]
    planned_duration_hours: float
    actual_duration_hours: Optional[float]
    status: str
    failure_reason: Optional[FailureReason] = None

    class Config:
        from_attributes = True
