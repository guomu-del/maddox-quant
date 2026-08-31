from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class WatchlistCreate(BaseModel):
    target_type: Literal["industry", "sector", "stock"]
    target_code: str = Field(min_length=1, max_length=50)
    target_name: str | None = None
    note: str | None = None


class WatchlistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target_type: str
    target_code: str
    target_name: str | None = None
    note: str | None = None
    created_at: datetime | None = None


class EventBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    title: str
    content: str | None = None
    related_type: str | None = None
    related_code: str | None = None
    report_id: int | None = None
    severity: str
    occurred_at: datetime | None = None


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    is_read: bool
    created_at: datetime | None = None
    event: EventBrief | None = None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModel):
    count: int
