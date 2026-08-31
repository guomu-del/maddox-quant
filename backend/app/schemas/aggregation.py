from pydantic import BaseModel, Field

from app.schemas.report import ReportResponse


class CountItem(BaseModel):
    name: str
    count: int


class TrendItem(BaseModel):
    week: str
    count: int


class OverviewResponse(BaseModel):
    total_reports: int
    analyzed_count: int
    sentiment_distribution: dict[str, int] = Field(default_factory=dict)
    top_industries: list[CountItem] = Field(default_factory=list)
    top_factors: list[CountItem] = Field(default_factory=list)
    report_trend: list[TrendItem] = Field(default_factory=list)
    recent_reports: list[ReportResponse] = Field(default_factory=list)


class IndustryAnalysisResponse(BaseModel):
    industry: str
    total_reports: int
    analyzed_count: int
    sentiment_distribution: dict[str, int] = Field(default_factory=dict)
    top_factors: list[CountItem] = Field(default_factory=list)
    related_stocks: list[CountItem] = Field(default_factory=list)
    reports: list[ReportResponse] = Field(default_factory=list)


class StockAnalysisResponse(BaseModel):
    stock: str
    total_reports: int
    analyzed_count: int
    sentiment_distribution: dict[str, int] = Field(default_factory=dict)
    target_prices: list[str] = Field(default_factory=list)
    reports: list[ReportResponse] = Field(default_factory=list)
