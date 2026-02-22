from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from fastapi_users import schemas


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
    sensor_default_hours: Optional[int] = None
    catheter_default_hours: Optional[int] = None
    reminder_intervals_hours: Optional[List[int]] = None
