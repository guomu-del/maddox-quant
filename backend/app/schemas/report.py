from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ReportCreate(BaseModel):
    title: str
    source: str | None = None
    author: str | None = None
    publish_date: date | None = None
    industries: list[str] = Field(default_factory=list)
    sectors: list[str] = Field(default_factory=list)
    stocks: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    summary: str | None = None


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source: str | None = None
    author: str | None = None
    publish_date: date | None = None
    industries: list[str] | None = None
    sectors: list[str] | None = None
    stocks: list[str] | None = None
    summary: str | None = None
    full_text: str | None = None
    file_path: str | None = None
    file_hash: str | None = None
    tags: list[str] | None = None
    status: str
    created_at: datetime | None = None


class ReportListResponse(BaseModel):
    items: list[ReportResponse]
    total: int
    page: int
    page_size: int


class DuplicateReportResponse(BaseModel):
    detail: str
    existing_report_id: int
