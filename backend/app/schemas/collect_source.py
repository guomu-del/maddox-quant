from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CollectSourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    source_type: str = "rss"
    url: str = Field(..., min_length=1)
    cron_expr: str = "0 8 * * *"
    parser: str = "rss"
    is_enabled: bool = True


class CollectSourceUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    source_type: str | None = None
    url: str | None = Field(None, min_length=1)
    cron_expr: str | None = None
    parser: str | None = None
    is_enabled: bool | None = None


class CollectSourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    source_type: str
    url: str
    cron_expr: str
    parser: str
    is_enabled: bool
    last_run_at: datetime | None
    last_status: str | None
    created_at: datetime


class CollectLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_id: int
    status: str
    items_found: int
    items_new: int
    error: str | None
    started_at: datetime
    finished_at: datetime | None


class CollectRunResponse(BaseModel):
    log_id: int
    status: str
    items_found: int
    items_new: int
