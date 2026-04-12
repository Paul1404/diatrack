from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, case
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from app.database import get_db
from app.config import get_settings
from app.models.user import User
from app.models.device import Device, DeviceType, DeviceStatus, BODY_LOCATION_LABELS
from app.models.failure_log import FailureLog, FailureReason, FAILURE_REASON_LABELS
from app.schemas.stats import (
    OverviewStats,
    MTBFStats,
    FailureByReason,
    FailureByLocation,
    FailureStats,
    HistoryEntry,
)
from app.auth import get_current_user

router = APIRouter(prefix="/api/stats", tags=["Statistics"])
settings = get_settings()


def _duration_hours_expr():
    """SQL expression for device duration in hours, compatible with both SQLite and PostgreSQL."""
    if "sqlite" in settings.database_url:
        return (func.julianday(Device.ended_at) - func.julianday(Device.start_time)) * 24.0
    return (func.extract('epoch', Device.ended_at) - func.extract('epoch', Device.start_time)) / 3600.0


@router.get("/overview", response_model=OverviewStats)
def get_overview_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get overview statistics for the dashboard."""
    duration_expr = _duration_hours_expr()

    # Single aggregate query for all counts and averages (replaces 8+ separate queries)
    counts = db.query(
        func.count(Device.id).label("total"),
        func.sum(case((Device.status == DeviceStatus.ACTIVE, 1), else_=0)).label("active"),
        func.sum(case((Device.status == DeviceStatus.COMPLETED, 1), else_=0)).label("completed"),
        func.sum(case((Device.status == DeviceStatus.FAILED, 1), else_=0)).label("failed"),
        func.sum(case((and_(
            Device.device_type == DeviceType.SENSOR,
            Device.status != DeviceStatus.ACTIVE,
        ), 1), else_=0)).label("sensor_total"),
        func.sum(case((and_(
            Device.device_type == DeviceType.SENSOR,
            Device.status == DeviceStatus.FAILED,
        ), 1), else_=0)).label("sensor_failed"),
        func.sum(case((and_(
            Device.device_type == DeviceType.CATHETER,
            Device.status != DeviceStatus.ACTIVE,
        ), 1), else_=0)).label("catheter_total"),
        func.sum(case((and_(
            Device.device_type == DeviceType.CATHETER,
            Device.status == DeviceStatus.FAILED,
        ), 1), else_=0)).label("catheter_failed"),
        func.avg(case((and_(
            Device.device_type == DeviceType.SENSOR,
            Device.status != DeviceStatus.ACTIVE,
            Device.ended_at.isnot(None),
        ), duration_expr), else_=None)).label("avg_sensor_hours"),
        func.avg(case((and_(
            Device.device_type == DeviceType.CATHETER,
            Device.status != DeviceStatus.ACTIVE,
            Device.ended_at.isnot(None),
        ), duration_expr), else_=None)).label("avg_catheter_hours"),
    ).filter(Device.user_id == current_user.id).first()

    total_devices = counts.total or 0
    active_devices = counts.active or 0
    completed_devices = counts.completed or 0
    failed_devices = counts.failed or 0
    sensor_total = counts.sensor_total or 0
    sensor_failed = counts.sensor_failed or 0
    catheter_total = counts.catheter_total or 0
    catheter_failed = counts.catheter_failed or 0

    sensor_failure_rate = (sensor_failed / sensor_total * 100) if sensor_total > 0 else 0
    catheter_failure_rate = (catheter_failed / catheter_total * 100) if catheter_total > 0 else 0

    return OverviewStats(
        total_devices=total_devices,
        active_devices=active_devices,
        completed_devices=completed_devices,
        failed_devices=failed_devices,
        sensor_failure_rate=round(sensor_failure_rate, 1),
        catheter_failure_rate=round(catheter_failure_rate, 1),
        avg_sensor_duration_hours=float(counts.avg_sensor_hours) if counts.avg_sensor_hours is not None else None,
        avg_catheter_duration_hours=float(counts.avg_catheter_hours) if counts.avg_catheter_hours is not None else None,
    )


@router.get("/failures", response_model=FailureStats)
def get_failure_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get detailed failure statistics."""
    # Failures by reason
    reason_counts = (
        db.query(FailureLog.reason, func.count(FailureLog.id).label("count"))
        .join(Device)
        .filter(Device.user_id == current_user.id)
        .group_by(FailureLog.reason)
        .all()
    )

    total_failures = sum(r.count for r in reason_counts) if reason_counts else 0

    by_reason = [
        FailureByReason(
            reason=r.reason,
            reason_label=FAILURE_REASON_LABELS.get(r.reason, str(r.reason)),
            count=r.count,
            percentage=round((r.count / total_failures * 100) if total_failures > 0 else 0, 1),
        )
        for r in reason_counts
    ]

    # Failures by body location
    location_stats = (
        db.query(
            Device.body_location,
            func.count(Device.id).label("total"),
            func.sum(case((Device.status == DeviceStatus.FAILED, 1), else_=0)).label("failed"),
        )
        .filter(
            and_(Device.user_id == current_user.id, Device.status != DeviceStatus.ACTIVE)
        )
        .group_by(Device.body_location)
        .all()
    )

    by_location = [
        FailureByLocation(
            body_location=loc.body_location,
            body_location_label=BODY_LOCATION_LABELS.get(loc.body_location, str(loc.body_location)),
            total_devices=loc.total,
            failed_devices=loc.failed or 0,
            failure_rate=round(((loc.failed or 0) / loc.total * 100) if loc.total > 0 else 0, 1),
        )
        for loc in location_stats
    ]

    # MTBF by device type (single aggregate query per type)
    duration_expr = _duration_hours_expr()
    by_device_type = []
    for device_type in [DeviceType.SENSOR, DeviceType.CATHETER]:
        result = db.query(
            func.sum(case((Device.status == DeviceStatus.COMPLETED, 1), else_=0)).label("total_completed"),
            func.sum(case((Device.status == DeviceStatus.FAILED, 1), else_=0)).label("total_failed"),
            func.avg(case(
                (Device.status == DeviceStatus.COMPLETED, duration_expr),
                else_=None,
            )).label("avg_completed_hours"),
        ).filter(
            and_(
                Device.user_id == current_user.id,
                Device.device_type == device_type,
                Device.status != DeviceStatus.ACTIVE,
                Device.ended_at.isnot(None),
            )
        ).first()

        total_completed = result.total_completed or 0
        total_failed = result.total_failed or 0
        mtbf_hours = round(float(result.avg_completed_hours), 1) if result.avg_completed_hours else None

        by_device_type.append(
            MTBFStats(
                device_type=device_type,
                mtbf_hours=mtbf_hours,
                total_failures=total_failed,
                total_completed=total_completed,
            )
        )

    return FailureStats(
        by_reason=by_reason,
        by_location=by_location,
        by_device_type=by_device_type,
    )


@router.get("/history", response_model=List[HistoryEntry])
def get_history(
    device_type: Optional[DeviceType] = None,
    days: int = Query(default=90, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get device history for the specified period."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = db.query(Device).filter(
        and_(
            Device.user_id == current_user.id,
            Device.start_time >= since,
        )
    )

    if device_type:
        query = query.filter(Device.device_type == device_type)

    devices = query.options(joinedload(Device.failure_log)).order_by(Device.start_time.desc()).all()

    result = []
    for d in devices:
        actual_duration = None
        if d.ended_at:
            start = d.start_time.replace(tzinfo=timezone.utc) if d.start_time.tzinfo is None else d.start_time
            end = d.ended_at.replace(tzinfo=timezone.utc) if d.ended_at.tzinfo is None else d.ended_at
            actual_duration = round((end - start).total_seconds() / 3600, 1)

        failure_reason = None
        if d.failure_log:
            failure_reason = d.failure_log.reason

        result.append(
            HistoryEntry(
                id=d.id,
                device_type=d.device_type,
                body_location=d.body_location,
                body_location_label=BODY_LOCATION_LABELS.get(d.body_location, str(d.body_location)),
                start_time=d.start_time,
                ended_at=d.ended_at,
                planned_duration_hours=d.planned_duration_hours,
                actual_duration_hours=actual_duration,
                status=d.status.value,
                failure_reason=failure_reason,
            )
        )

    return result
