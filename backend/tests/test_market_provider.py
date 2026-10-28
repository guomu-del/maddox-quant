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
    _attach_tencent_metrics,
    _daily_symbol,
    _map_board_row,
    _map_index_row,
    _map_kline_frame,
    _map_stock_row,
    _parse_tencent_quote,
    _quote_symbol,
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


def test_quote_symbol_maps_beijing_nine_two_codes():
    assert _quote_symbol("600519") == "sh600519"
    assert _quote_symbol("000001") == "sz000001"
    assert _quote_symbol("300750") == "sz300750"
    assert _quote_symbol("430047") == "bj430047"
    assert _quote_symbol("920220") == "bj920220"


def test_map_stock_row_reads_sina_ohlcv_and_em_valuation_columns():
    quote = _map_stock_row(
        {
            "代码": "600519",
            "名称": "贵州茅台",
            "最新价": 1330.75,
            "涨跌额": -25.15,
            "涨跌幅": -1.85,
            "今开": 1354.98,
            "最高": 1354.98,
            "最低": 1322.60,
            "昨收": 1355.90,
            "成交量": 38805,
            "成交额": 5187324618,
            "换手率": 0.31,
            "市盈率-动态": 20.43,
        }
    )
    assert quote.open == 1354.98
    assert quote.high == 1354.98
    assert quote.low == 1322.60
    assert quote.prev_close == 1355.90
    assert quote.volume == 38805
    assert quote.turnover == 0.31
    assert quote.pe == 20.43


def test_parse_tencent_quote_reads_turnover_and_pe():
    line = (
        'v_sh600519="1~贵州茅台~600519~1330.75~1355.90~1354.98~38805~17108~21696~1330.75~9~1330.72~3~'
        "1330.71~12~1330.70~1~1330.59~1~1330.77~5~1330.96~1~1330.99~1~1331.00~1~1331.07~22~~"
        "20261028161454~-25.15~-1.85~1354.98~1322.60~1330.75/38805/5187324618~38805~518732~0.31~20.43~~"
        '1354.98~1322.60~2.39~16635.46~16635.46~6.62~1491.49~1220.31~0.91~-4~1336.77~18.68~20.21";'
    )
    parsed = _parse_tencent_quote(line)
    assert parsed == ("600519", 0.31, 20.43)
    assert _parse_tencent_quote('v_pv_none_match="1";') is None


def test_attach_tencent_metrics_fills_missing_turnover_and_pe(monkeypatch):
    rows = [
        _map_stock_row({"代码": "600519", "名称": "贵州茅台", "最新价": 1330.75}),
        _map_stock_row({"代码": "000001", "名称": "平安银行", "最新价": 11.31, "换手率": 0.87, "市盈率-动态": 5.05}),
    ]
    monkeypatch.setattr(
        market_provider,
        "_fetch_tencent_metrics",
        lambda codes: {"600519": (0.31, 20.43), "000001": (9.9, 99.9)},
    )
    filled = _attach_tencent_metrics(rows)
    assert filled[0].turnover == 0.31
    assert filled[0].pe == 20.43
    assert filled[1].turnover == 0.87
    assert filled[1].pe == 5.05


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
