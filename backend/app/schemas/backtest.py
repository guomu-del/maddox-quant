from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class BacktestCreate(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")
    strategy_id: str
    params: dict[str, int | float] = Field(default_factory=dict)
    start: date | None = None
    end: date | None = None
    cash: float = Field(default=1_000_000, gt=0)


class StrategyInfo(BaseModel):
    id: str
    name: str
    params: dict[str, int]


class BacktestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    strategy_id: str
    params: dict
    start: date
    end: date
    cash: float
    status: str
    metrics: dict | None
    equity: list | None
    trades: list | None
    error: str | None
    created_at: datetime | None = None
