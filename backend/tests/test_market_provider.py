from urllib.parse import urlparse

from app.services.market_provider import (
    _map_board_row,
    _map_index_row,
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
