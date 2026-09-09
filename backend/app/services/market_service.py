from __future__ import annotations

import logging
import re
from collections.abc import Callable
from datetime import date, datetime
from typing import Protocol, TypeVar
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.errors import AppError
from app.core.ttl_cache import TtlCache
from app.schemas.market import (
    BoardListResponse,
    BoardQuote,
    IndexQuote,
    KlineBar,
    KlineResponse,
    MarketOverviewResponse,
    MarketStats,
    StockListResponse,
    StockQuote,
)
from app.services.market_provider import AkshareMarketProvider, CORE_INDEX_CODES

CACHE_INDICES = "indices"
CACHE_STOCKS = "stocks"
CACHE_BOARDS = "boards"
LIMIT_PCT = 9.8
SHANGHAI = ZoneInfo("Asia/Shanghai")
logger = logging.getLogger(__name__)
SORT_FIELDS = {
    "change_pct": lambda item: item.change_pct,
    "amount": lambda item: item.amount,
    "turnover": lambda item: item.turnover,
    "code": lambda item: item.code,
}
CODE_RE = re.compile(r"^\d{6}$")

T = TypeVar("T")


class MarketSource(Protocol):
    def fetch_index_quotes(self) -> list[IndexQuote]: ...
    def fetch_stock_snapshots(self) -> list[StockQuote]: ...
    def fetch_daily_bars(
        self, code: str, *, start: date | None, end: date | None, limit: int
    ) -> list[KlineBar]: ...
    def fetch_industry_boards(self) -> list[BoardQuote]: ...


_cache = TtlCache(ttl_seconds=settings.market_cache_ttl_seconds)
_kline_cache = TtlCache(ttl_seconds=settings.market_kline_ttl_seconds)
_provider: MarketSource = AkshareMarketProvider()


def is_trading_now(now: datetime | None = None) -> bool:
    current = now.astimezone(SHANGHAI) if now else datetime.now(SHANGHAI)
    if current.weekday() >= 5:
        return False
    minutes = current.hour * 60 + current.minute
    return 9 * 60 + 15 <= minutes <= 15 * 60 + 10


def _load(key: str, loader: Callable[[], T]) -> tuple[T, bool]:
    try:
        return _cache.get_or_load(key, loader)
    except Exception as exc:
        logger.exception("market source load failed for %s", key)
        raise AppError(
            "行情源暂时不可用",
            code="market_source_error",
            status_code=502,
        ) from exc


def get_overview(provider: MarketSource | None = None) -> MarketOverviewResponse:
    source = provider or _provider
    indices, indices_stale = _load(CACHE_INDICES, source.fetch_index_quotes)
    stocks, stocks_stale = _load(CACHE_STOCKS, source.fetch_stock_snapshots)
    stale = indices_stale or stocks_stale
    as_of = datetime.now(SHANGHAI)
    return MarketOverviewResponse(
        indices=_align_indices(indices),
        stats=_stats(stocks),
        as_of=as_of,
        stale=stale,
        is_trading=is_trading_now(),
    )


def get_stocks(
    *,
    q: str | None = None,
    sort: str = "change_pct",
    order: str = "desc",
    page: int = 1,
    page_size: int = 50,
    provider: MarketSource | None = None,
) -> StockListResponse:
    source = provider or _provider
    stocks, stale = _load(CACHE_STOCKS, source.fetch_stock_snapshots)
    query = (q or "").strip().lower()
    filtered = [
        item
        for item in stocks
        if not query or query in item.code.lower() or query in item.name.lower()
    ]
    field = sort if sort in SORT_FIELDS else "change_pct"
    reverse = order != "asc"
    if field == "code":
        filtered.sort(key=lambda item: item.code, reverse=reverse)
    else:
        numbered = [item for item in filtered if SORT_FIELDS[field](item) is not None]
        missing = [item for item in filtered if SORT_FIELDS[field](item) is None]
        numbered.sort(key=SORT_FIELDS[field], reverse=reverse)
        filtered = numbered + missing

    total = len(filtered)
    start = (page - 1) * page_size
    return StockListResponse(
        items=filtered[start : start + page_size],
        total=total,
        page=page,
        page_size=page_size,
        as_of=datetime.now(SHANGHAI),
        stale=stale,
    )


def _require_code(code: str) -> str:
    text = (code or "").strip()
    if not CODE_RE.match(text):
        raise AppError("股票代码须为6位数字", code="invalid_stock_code", status_code=400)
    return text


def get_stock(code: str, provider: MarketSource | None = None) -> StockQuote:
    source = provider or _provider
    code = _require_code(code)
    stocks, _ = _load(CACHE_STOCKS, source.fetch_stock_snapshots)
    for item in stocks:
        if item.code == code:
            return item
    raise AppError("未找到该股票报价", code="stock_not_found", status_code=404)


def get_kline(
    code: str,
    *,
    limit: int = 250,
    start: date | None = None,
    end: date | None = None,
    provider: MarketSource | None = None,
) -> KlineResponse:
    source = provider or _provider
    code = _require_code(code)
    key = f"kline:{code}:daily:{start}:{end}:{limit}"

    def loader():
        items = source.fetch_daily_bars(code, start=start, end=end, limit=limit)
        if not items:
            raise AppError(
                "行情源暂时不可用",
                code="market_source_error",
                status_code=502,
            )
        return items

    try:
        items, stale = _kline_cache.get_or_load(key, loader)
    except AppError:
        raise
    except Exception as exc:
        logger.exception("kline load failed for %s", code)
        raise AppError("行情源暂时不可用", code="market_source_error", status_code=502) from exc
    return KlineResponse(code=code, items=items, as_of=datetime.now(SHANGHAI), stale=stale)


def get_boards(provider: MarketSource | None = None) -> BoardListResponse:
    source = provider or _provider
    boards, stale = _load(CACHE_BOARDS, source.fetch_industry_boards)
    ranked = sorted(
        boards,
        key=lambda item: ((item.change_pct is None), item.change_pct or 0),
        reverse=True,
    )
    return BoardListResponse(items=ranked, as_of=datetime.now(SHANGHAI), stale=stale)


def _align_indices(indices: list[IndexQuote]) -> list[IndexQuote]:
    by_code = {item.code: item for item in indices}
    return [by_code[code] for code in CORE_INDEX_CODES if code in by_code] or indices


def _stats(stocks: list[StockQuote]) -> MarketStats:
    up = down = flat = limit_up = limit_down = 0
    total_amount = 0.0
    for item in stocks:
        if item.amount:
            total_amount += item.amount
        pct = item.change_pct
        if pct is None:
            continue
        if pct > 0:
            up += 1
        elif pct < 0:
            down += 1
        else:
            flat += 1
        if pct >= LIMIT_PCT:
            limit_up += 1
        elif pct <= -LIMIT_PCT:
            limit_down += 1
    return MarketStats(
        up_count=up,
        down_count=down,
        flat_count=flat,
        limit_up_count=limit_up,
        limit_down_count=limit_down,
        total_amount=total_amount,
    )


def reset_market_cache_for_tests(cache: TtlCache | None = None) -> None:
    global _cache, _kline_cache
    _cache = cache or TtlCache(ttl_seconds=settings.market_cache_ttl_seconds)
    _kline_cache = cache or TtlCache(ttl_seconds=settings.market_kline_ttl_seconds)
