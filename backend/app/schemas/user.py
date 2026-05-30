from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from fastapi_users import schemas

# One year in hours — a sane upper bound for any device lifetime / reminder.
MAX_HOURS = 8760


class UserSettings(BaseModel):
    sensor_default_hours: int = 240
    catheter_default_hours: int = 72
    reminder_intervals_hours: List[int] = [24, 6]


class UserRead(schemas.BaseUser[int]):
    settings: UserSettings = UserSettings()
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(schemas.BaseUserCreate):
    pass


class UserUpdate(schemas.BaseUserUpdate):
    pass


class UserSettingsUpdate(BaseModel):
    sensor_default_hours: Optional[int] = Field(None, ge=1, le=MAX_HOURS)
    catheter_default_hours: Optional[int] = Field(None, ge=1, le=MAX_HOURS)
    reminder_intervals_hours: Optional[List[int]] = None

    @field_validator("reminder_intervals_hours")
    @classmethod
    def validate_intervals(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        if v is None:
            return v
        if len(v) > 10:
            raise ValueError("Höchstens 10 Erinnerungs-Intervalle erlaubt.")
        for hours in v:
            if hours < 1 or hours > MAX_HOURS:
                raise ValueError(
                    f"Erinnerungs-Intervalle müssen zwischen 1 und {MAX_HOURS} Stunden liegen."
                )
        # De-duplicate and sort descending (earliest reminder first).
        return sorted(set(v), reverse=True)
