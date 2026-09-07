from datetime import datetime

from pydantic import BaseModel


class IndexQuote(BaseModel):
    code: str
    name: str
    last: float | None = None
    change_pct: float | None = None
    change_amt: float | None = None


class MarketStats(BaseModel):
    up_count: int
    down_count: int
    flat_count: int
    limit_up_count: int
    limit_down_count: int
    total_amount: float


class MarketOverviewResponse(BaseModel):
    indices: list[IndexQuote]
    stats: MarketStats
    as_of: datetime
    stale: bool
    is_trading: bool


class StockQuote(BaseModel):
    code: str
    name: str
    last: float | None = None
    change_pct: float | None = None
    change_amt: float | None = None
    amount: float | None = None
    turnover: float | None = None
    pe: float | None = None


class StockListResponse(BaseModel):
    items: list[StockQuote]
    total: int
    page: int
    page_size: int
    as_of: datetime
    stale: bool


class BoardQuote(BaseModel):
    code: str
    name: str
    change_pct: float | None = None
    lead_stock: str | None = None
    lead_change_pct: float | None = None
    up_count: int | None = None
    down_count: int | None = None


class BoardListResponse(BaseModel):
    items: list[BoardQuote]
    as_of: datetime
    stale: bool
