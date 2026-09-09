from datetime import date
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock
from urllib.parse import urlparse

import pandas as pd
import pytest

from app.services import market_provider
from app.services.market_provider import (
    AkshareMarketProvider,
    _daily_symbol,
    _map_board_row,
    _map_index_row,
    _map_kline_frame,
    _map_stock_row,
    rotate_push2_url,
)


def test_map_board_row_reads_hyphenated_lead_change_column():
    quote = _map_board_row(
        {
            "板块代码": "BK0475",
            "板块名称": "银行",
            "涨跌幅": 1.25,
            "领涨股票": "平安银行",
            "领涨股票-涨跌幅": 2.5,
            "上涨家数": 10,
            "下跌家数": 4,
        }
    )
    assert quote.code == "BK0475"
    assert quote.name == "银行"
    assert quote.lead_stock == "平安银行"
    assert quote.lead_change_pct == 2.5
    assert quote.up_count == 10


def test_map_board_row_reads_ths_summary_columns():
    quote = _map_board_row(
        {
            "板块": "元件",
            "涨跌幅": 6.83,
            "领涨股": "则成电子",
            "领涨股-涨跌幅": 29.97,
            "上涨家数": 63,
            "下跌家数": 0,
        }
    )
    assert quote.code == "元件"
    assert quote.name == "元件"
    assert quote.lead_stock == "则成电子"
    assert quote.lead_change_pct == 29.97
    assert quote.up_count == 63


def test_map_stock_and_index_codes_are_six_digits():
    stock = _map_stock_row({"代码": "1", "名称": "测试", "涨跌幅": 1.0})
    index = _map_index_row({"代码": "sh000001", "名称": "上证指数", "最新价": 3000})
    assert stock.code == "000001"
    assert index.code == "000001"


def test_rotate_push2_url_swaps_numbered_host():
    url = "https://17.push2.eastmoney.com/api/qt/clist/get"
    rotated = rotate_push2_url(url, "82.push2.eastmoney.com")
    assert urlparse(rotated).netloc == "82.push2.eastmoney.com"
    assert urlparse(rotated).path == "/api/qt/clist/get"
    other = rotate_push2_url("https://example.com/x", "82.push2.eastmoney.com")
    assert other == "https://example.com/x"


def test_daily_symbol_maps_exchange_prefixes():
    assert _daily_symbol("600519") == "sh600519"
    assert _daily_symbol("000001") == "sz000001"
    assert _daily_symbol("430047") == "bj430047"


def test_map_kline_frame_maps_and_sorts_rows():
    frame = pd.DataFrame(
        [
            {"日期": "2026-01-06", "开盘": 10.5, "最高": 12, "最低": 10.4, "收盘": 11.8, "成交量": 1200, "成交额": 14000},
            {"日期": "2026-01-05", "开盘": 10, "最高": 11, "最低": 9.5, "收盘": 10.5, "成交量": 1000, "成交额": 10500},
        ]
    )

    bars = _map_kline_frame(frame)

    assert [bar.date for bar in bars] == [date(2026, 1, 5), date(2026, 1, 6)]
    assert bars[0].open == 10
    assert bars[1].amount == 14000


def test_fetch_daily_bars_uses_hist_with_expected_arguments(monkeypatch):
    hist = MagicMock(
        return_value=pd.DataFrame(
            [{"日期": "2026-01-05", "开盘": 10, "最高": 11, "最低": 9, "收盘": 10.5}]
        )
    )
    daily = MagicMock()
    patch_http = MagicMock()
    monkeypatch.setitem(
        sys.modules,
        "akshare",
        SimpleNamespace(stock_zh_a_hist=hist, stock_zh_a_daily=daily),
    )
    monkeypatch.setattr(market_provider, "patch_akshare_http", patch_http)

    bars = AkshareMarketProvider().fetch_daily_bars("600519")

    patch_http.assert_called_once_with()
    hist.assert_called_once_with(
        symbol="600519",
        period="daily",
        start_date="19700101",
        end_date="20991231",
        adjust="qfq",
    )
    daily.assert_not_called()
    assert [bar.date for bar in bars] == [date(2026, 1, 5)]


@pytest.mark.parametrize("hist_failure", ["empty", "exception"])
def test_fetch_daily_bars_falls_back_to_daily(monkeypatch, hist_failure):
    hist = (
        MagicMock(return_value=pd.DataFrame())
        if hist_failure == "empty"
        else MagicMock(side_effect=RuntimeError("hist unavailable"))
    )
    daily = MagicMock(
        return_value=pd.DataFrame(
            [{"date": "2026-01-05", "open": 10, "high": 11, "low": 9, "close": 10.5}]
        )
    )
    monkeypatch.setitem(
        sys.modules,
        "akshare",
        SimpleNamespace(stock_zh_a_hist=hist, stock_zh_a_daily=daily),
    )
    monkeypatch.setattr(market_provider, "patch_akshare_http", MagicMock())

    bars = AkshareMarketProvider().fetch_daily_bars("600519")

    daily.assert_called_once_with(symbol=_daily_symbol("600519"), adjust="qfq")
    assert len(bars) == 1


def test_fetch_daily_bars_filters_dates_and_applies_trailing_limit(monkeypatch):
    hist = MagicMock(
        return_value=pd.DataFrame(
            [
                {"日期": f"2026-01-0{day}", "开盘": day, "最高": day, "最低": day, "收盘": day}
                for day in range(1, 6)
            ]
        )
    )
    monkeypatch.setitem(
        sys.modules,
        "akshare",
        SimpleNamespace(stock_zh_a_hist=hist, stock_zh_a_daily=MagicMock()),
    )
    monkeypatch.setattr(market_provider, "patch_akshare_http", MagicMock())

    bars = AkshareMarketProvider().fetch_daily_bars(
        "600519",
        start=date(2026, 1, 2),
        end=date(2026, 1, 4),
        limit=2,
    )

    assert [bar.date for bar in bars] == [date(2026, 1, 3), date(2026, 1, 4)]


@pytest.mark.parametrize("failure_mode", ["empty", "exception"])
def test_fetch_daily_bars_returns_empty_when_both_sources_fail(monkeypatch, failure_mode):
    if failure_mode == "empty":
        hist = MagicMock(return_value=pd.DataFrame())
        daily = MagicMock(return_value=pd.DataFrame())
    else:
        hist = MagicMock(side_effect=RuntimeError("hist unavailable"))
        daily = MagicMock(side_effect=RuntimeError("daily unavailable"))
    monkeypatch.setitem(
        sys.modules,
        "akshare",
        SimpleNamespace(stock_zh_a_hist=hist, stock_zh_a_daily=daily),
    )
    monkeypatch.setattr(market_provider, "patch_akshare_http", MagicMock())

    assert AkshareMarketProvider().fetch_daily_bars("600519") == []
