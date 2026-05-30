from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from datetime import datetime, timezone
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.device import Device, DeviceType, DeviceStatus, BODY_LOCATION_LABELS
from app.models.failure_log import FailureLog, FAILURE_REASON_LABELS
from app.schemas.device import (
    DeviceCreate,
    DeviceUpdate,
    DeviceResponse,
    DeviceFailureRequest,
)
from app.auth import get_current_user

router = APIRouter(prefix="/api/devices", tags=["Devices"])


def calculate_device_progress(device: Device) -> tuple[float, float]:
    """Calculate remaining hours and progress percent for a device."""
    if device.status != DeviceStatus.ACTIVE:
        return None, None

    now = datetime.now(timezone.utc)
    start = device.start_time.replace(tzinfo=timezone.utc) if device.start_time.tzinfo is None else device.start_time
    elapsed_hours = (now - start).total_seconds() / 3600

    duration = device.planned_duration_hours
    # Guard against bad/legacy data: a non-positive duration would divide by
    # zero. Treat such a device as already expired rather than crashing.
    if not duration or duration <= 0:
        return 0.0, 100.0

    remaining_hours = max(0, duration - elapsed_hours)
    progress_percent = min(100, (elapsed_hours / duration) * 100)

    return remaining_hours, progress_percent


def device_to_response(device: Device) -> DeviceResponse:
    """Convert Device model to DeviceResponse schema."""
    remaining_hours, progress_percent = calculate_device_progress(device)

    failure_reason = None
    failure_notes = None
    if device.failure_log:
        failure_reason = device.failure_log.reason
        failure_notes = device.failure_log.notes

    return DeviceResponse(
        id=device.id,
        device_type=device.device_type,
        body_location=device.body_location,
        body_location_label=BODY_LOCATION_LABELS.get(device.body_location, str(device.body_location)),
        start_time=device.start_time,
        planned_duration_hours=device.planned_duration_hours,
        status=device.status,
        ended_at=device.ended_at,
        created_at=device.created_at,
        remaining_hours=remaining_hours,
        progress_percent=progress_percent,
        failure_reason=failure_reason,
        failure_notes=failure_notes,
    )


@router.get("", response_model=List[DeviceResponse])
def list_devices(
    active_only: bool = False,
    device_type: DeviceType = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all devices for the current user."""
    query = db.query(Device).filter(Device.user_id == current_user.id)

    if active_only:
        query = query.filter(Device.status == DeviceStatus.ACTIVE)

    if device_type:
        query = query.filter(Device.device_type == device_type)

    devices = query.options(joinedload(Device.failure_log)).order_by(Device.start_time.desc()).all()
    return [device_to_response(d) for d in devices]


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    device_data: DeviceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new device entry."""
    # Use current time if not specified
    start_time = device_data.start_time or datetime.now(timezone.utc)

    # Use user defaults if duration not specified
    if device_data.planned_duration_hours is None:
        if device_data.device_type == DeviceType.SENSOR:
            planned_duration = current_user.settings.get("sensor_default_hours", 240)
        else:
            planned_duration = current_user.settings.get("catheter_default_hours", 72)
    else:
        planned_duration = device_data.planned_duration_hours

    # Final safety net against legacy settings that stored a 0/negative value.
    if not planned_duration or planned_duration <= 0:
        planned_duration = 240 if device_data.device_type == DeviceType.SENSOR else 72

    device = Device(
        user_id=current_user.id,
        device_type=device_data.device_type,
        body_location=device_data.body_location,
        start_time=start_time,
        planned_duration_hours=planned_duration,
        status=DeviceStatus.ACTIVE,
        reminders_sent="",
    )

    db.add(device)
    db.commit()
    db.refresh(device)

    return device_to_response(device)


@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific device."""
    device = db.query(Device).filter(
        and_(Device.id == device_id, Device.user_id == current_user.id)
    ).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    return device_to_response(device)


@router.patch("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: int,
    update_data: DeviceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a device (e.g. start_time)."""
    device = db.query(Device).filter(
        and_(Device.id == device_id, Device.user_id == current_user.id)
    ).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    if update_data.start_time is not None:
        device.start_time = update_data.start_time

    db.commit()
    db.refresh(device)

    return device_to_response(device)


@router.put("/{device_id}/end", response_model=DeviceResponse)
def end_device(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a device as completed (normal end)."""
    device = db.query(Device).filter(
        and_(Device.id == device_id, Device.user_id == current_user.id)
    ).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    if device.status != DeviceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device is not active",
        )

    device.status = DeviceStatus.COMPLETED
    device.ended_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(device)

    return device_to_response(device)


@router.post("/{device_id}/failure", response_model=DeviceResponse)
def report_failure(
    device_id: int,
    failure_data: DeviceFailureRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a device as failed with a reason."""
    device = db.query(Device).filter(
        and_(Device.id == device_id, Device.user_id == current_user.id)
    ).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    if device.status != DeviceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device is not active",
        )

    # Update device status
    device.status = DeviceStatus.FAILED
    device.ended_at = failure_data.failed_at or datetime.now(timezone.utc)

    # Create failure log
    failure_log = FailureLog(
        device_id=device.id,
        reason=failure_data.reason,
        notes=failure_data.notes,
    )
    db.add(failure_log)
    db.commit()
    db.refresh(device)

    return device_to_response(device)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a device."""
    device = db.query(Device).filter(
        and_(Device.id == device_id, Device.user_id == current_user.id)
    ).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    db.delete(device)
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all non-active (completed/failed) devices for the current user."""
    # First delete related failure logs via subquery
    non_active_ids = db.query(Device.id).filter(
        and_(
            Device.user_id == current_user.id,
            Device.status != DeviceStatus.ACTIVE,
        )
    ).subquery()

    db.query(FailureLog).filter(
        FailureLog.device_id.in_(non_active_ids)
    ).delete(synchronize_session=False)

    db.query(Device).filter(
        and_(
            Device.user_id == current_user.id,
            Device.status != DeviceStatus.ACTIVE,
        )
    ).delete(synchronize_session=False)

    db.commit()
    return None
