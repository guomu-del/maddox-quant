from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MetricItem(BaseModel):
    name: str
    value: str
    context: str | None = None


class FactorItem(BaseModel):
    name: str
    direction: Literal["positive", "negative", "neutral"]
    description: str | None = None


class AnalysisOutput(BaseModel):
    summary: str
    sentiment: Literal["bullish", "neutral", "bearish"]
    investment_thesis: str
    metrics: list[MetricItem] = Field(default_factory=list)
    factors: list[FactorItem] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


class AnalysisResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    report_id: int
    summary: str | None = None
    metrics: list[MetricItem] | None = None
    factors: list[FactorItem] | None = None
    sentiment: str | None = None
    investment_thesis: str | None = None
    risks: list[str] | None = None
    created_at: datetime | None = None


class AnalysisJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    report_id: int
    status: str
    error: str | None = None
    created_at: datetime | None = None
    finished_at: datetime | None = None


class AnalyzeStartResponse(BaseModel):
    job_id: int
