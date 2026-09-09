from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from app.core.errors import AppError
from app.core.ttl_cache import TtlCache
from app.schemas.market import BoardQuote, IndexQuote, KlineBar, StockQuote
from app.services import market_service
from app.services.market_service import is_trading_now


class FakeProvider:
    def __init__(self) -> None:
        self.stock_calls = 0
        self.fail_stocks = False

    def fetch_index_quotes(self) -> list[IndexQuote]:
        return [
            IndexQuote(code="000001", name="上证指数", last=3000.0, change_pct=1.2, change_amt=36.0),
            IndexQuote(code="399001", name="深证成指", last=10000.0, change_pct=-0.5, change_amt=-50.0),
            IndexQuote(code="399006", name="创业板指", last=2000.0, change_pct=0.0, change_amt=0.0),
            IndexQuote(code="000300", name="沪深300", last=4000.0, change_pct=0.8, change_amt=32.0),
        ]

    def fetch_stock_snapshots(self) -> list[StockQuote]:
        self.stock_calls += 1
        if self.fail_stocks:
            raise RuntimeError("source down")
        return [
            StockQuote(
                code="600519",
                name="贵州茅台",
                last=1400,
                change_pct=2.0,
                change_amt=28,
                amount=1_000_000_000,
                turnover=1.2,
                pe=30,
            ),
            StockQuote(
                code="000001",
                name="平安银行",
                last=10,
                change_pct=-1.0,
                change_amt=-0.1,
                amount=500_000_000,
                turnover=2.0,
                pe=8,
            ),
            StockQuote(
                code="300750",
                name="宁德时代",
                last=200,
                change_pct=10.1,
                change_amt=18,
                amount=2_000_000_000,
                turnover=3.0,
                pe=20,
            ),
        ]

    def fetch_daily_bars(self, code: str, *, start=None, end=None, limit: int = 250):
        bars = [
            KlineBar(date=date(2026, 1, 5), open=10, high=11, low=9.5, close=10.5, volume=1000, amount=10500),
            KlineBar(date=date(2026, 1, 6), open=10.5, high=12, low=10.4, close=11.8, volume=1200, amount=14000),
        ]
        return bars[:limit]

    def fetch_industry_boards(self) -> list[BoardQuote]:
        return [
            BoardQuote(
                code="BK0475",
                name="银行",
                change_pct=1.1,
                lead_stock="平安银行",
                lead_change_pct=2.0,
                up_count=10,
                down_count=5,
            ),
            BoardQuote(
                code="BK1033",
                name="白酒",
                change_pct=-0.4,
                lead_stock="贵州茅台",
                lead_change_pct=2.0,
                up_count=3,
                down_count=8,
            ),
        ]


def setup_function() -> None:
    market_service.reset_market_cache_for_tests(TtlCache(ttl_seconds=30))


def test_overview_aggregates_stats():
    overview = market_service.get_overview(provider=FakeProvider())
    assert [item.code for item in overview.indices] == ["000001", "399001", "399006", "000300"]
    assert overview.stats.up_count == 2
    assert overview.stats.down_count == 1
    assert overview.stats.flat_count == 0
    assert overview.stats.limit_up_count == 1
    assert overview.stats.limit_down_count == 0
    assert overview.stats.total_amount == 3_500_000_000
    assert overview.stale is False


def test_stock_search_sort_and_page():
    provider = FakeProvider()
    page = market_service.get_stocks(q="茅台", sort="change_pct", order="desc", page=1, page_size=50, provider=provider)
    assert page.total == 1
    assert page.items[0].code == "600519"

    ranked = market_service.get_stocks(sort="change_pct", order="desc", page=1, page_size=2, provider=provider)
    assert [item.code for item in ranked.items] == ["300750", "600519"]
    assert ranked.total == 3
    assert provider.stock_calls == 1


def test_boards_sorted_desc():
    boards = market_service.get_boards(provider=FakeProvider())
    assert [item.name for item in boards.items] == ["银行", "白酒"]


def test_stale_true_when_loader_fails_after_cache():
    cache = TtlCache(ttl_seconds=0.01)
    market_service.reset_market_cache_for_tests(cache)
    provider = FakeProvider()
    market_service.get_stocks(provider=provider)
    import time

    time.sleep(0.02)
    provider.fail_stocks = True
    page = market_service.get_stocks(provider=provider)
    assert page.stale is True
    assert page.total == 3


def test_is_trading_weekday_window():
    tz = ZoneInfo("Asia/Shanghai")
    morning = datetime(2026, 9, 7, 10, 0, tzinfo=tz)  # Monday
    night = datetime(2026, 9, 7, 16, 0, tzinfo=tz)
    sunday = datetime(2026, 9, 6, 10, 0, tzinfo=tz)
    assert is_trading_now(morning) is True
    assert is_trading_now(night) is False
    assert is_trading_now(sunday) is False


def test_get_stock_from_snapshot():
    quote = market_service.get_stock("600519", provider=FakeProvider())
    assert quote.code == "600519"
    assert quote.name == "贵州茅台"


def test_get_stock_rejects_bad_code():
    try:
        market_service.get_stock("abc", provider=FakeProvider())
        raise AssertionError("expected AppError")
    except AppError as exc:
        assert exc.status_code == 400
        assert exc.code == "invalid_stock_code"


def test_get_kline_returns_bars():
    page = market_service.get_kline("600519", limit=10, provider=FakeProvider())
    assert page.code == "600519"
    assert len(page.items) == 2
    assert page.items[0].open == 10


def test_get_kline_empty_source_raises_and_is_not_cached():
    class EmptyProvider(FakeProvider):
        def __init__(self) -> None:
            super().__init__()
            self.kline_calls = 0

        def fetch_daily_bars(
            self, code: str, *, start=None, end=None, limit: int = 250
        ):
            self.kline_calls += 1
            return []

    provider = EmptyProvider()

    for _ in range(2):
        with pytest.raises(AppError) as exc_info:
            market_service.get_kline("600519", provider=provider)
        assert exc_info.value.status_code == 502
        assert exc_info.value.code == "market_source_error"

    assert provider.kline_calls == 2
