from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.services.trading_fees import COMMISSION_MIN, COMMISSION_RATE, STAMP_TAX_RATE


class BacktestCreate(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")
    pair_code: str | None = Field(default=None, pattern=r"^\d{6}$")
    strategy_id: str
    params: dict[str, int | float | str] = Field(default_factory=dict)
    start: date | None = None
    end: date | None = None
    cash: float = Field(gt=0)
    commission_rate: float = Field(default=COMMISSION_RATE, ge=0)
    commission_min: float = Field(default=COMMISSION_MIN, ge=0)
    stamp_tax_rate: float = Field(default=STAMP_TAX_RATE, ge=0)


class StrategyInfo(BaseModel):
    id: str
    name: str
    params: dict[str, int | float]


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
