from __future__ import annotations

import random
import threading
import time
from collections.abc import Mapping
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

import requests

from app.core.config import settings
from app.schemas.market import BoardQuote, IndexQuote, StockQuote

CORE_INDEX_CODES = ("000001", "399001", "399006", "000300")
MIN_STOCK_ROWS = 2000
_PUSH2_HOSTS = (
    "82.push2.eastmoney.com",
    "88.push2.eastmoney.com",
    "79.push2.eastmoney.com",
    "48.push2.eastmoney.com",
    "33.push2.eastmoney.com",
    "push2.eastmoney.com",
    "17.push2.eastmoney.com",
    "push2delay.eastmoney.com",
)
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Referer": "https://quote.eastmoney.com/",
    "Accept": "application/json, text/plain, */*",
}
_http_patched = False
_http_patch_lock = threading.Lock()
_original_requests_get = requests.get

INDEX_NAME_HINTS = {
    "000001": "上证指数",
    "399001": "深证成指",
    "399006": "创业板指",
    "000300": "沪深300",
}


def _to_float(value: object) -> float | None:
    if value is None or value == "" or value == "-":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def _to_int(value: object) -> int | None:
    number = _to_float(value)
    return None if number is None else int(number)


def rotate_push2_url(url: str, host: str) -> str:
    parsed = urlparse(url)
    if "push2.eastmoney.com" not in parsed.netloc:
        return url
    return urlunparse(parsed._replace(netloc=host))


def request_eastmoney(url: str, params: dict | None = None, timeout: int = 15, **_kwargs):
    last_exception: BaseException | None = None
    parsed = urlparse(url)
    hosts = [parsed.netloc]
    if "push2.eastmoney.com" in parsed.netloc:
        hosts.extend(host for host in _PUSH2_HOSTS if host != parsed.netloc)
    for attempt, host in enumerate(hosts[:6]):
        target = rotate_push2_url(url, host)
        try:
            response = _original_requests_get(
                target,
                params=params,
                timeout=timeout,
                headers=_BROWSER_HEADERS,
            )
            response.raise_for_status()
            return response
        except (requests.RequestException, ValueError) as exc:
            last_exception = exc
            if attempt < 5:
                time.sleep(0.25 * (2**attempt) + random.uniform(0.05, 0.25))
    assert last_exception is not None
    raise last_exception


def _eastmoney_aware_get(url, params=None, **kwargs):
    if "eastmoney.com" in str(url):
        timeout = kwargs.pop("timeout", 15)
        kwargs.pop("headers", None)
        return request_eastmoney(url, params=params, timeout=timeout, **kwargs)
    return _original_requests_get(url, params=params, **kwargs)


def patch_akshare_http() -> None:
    global _http_patched
    if _http_patched:
        return
    with _http_patch_lock:
        if _http_patched:
            return
        requests.get = _eastmoney_aware_get
        try:
            import akshare.utils.func as ak_func
            import akshare.utils.request as ak_request

            ak_request.request_with_retry = request_eastmoney
            ak_func.request_with_retry = request_eastmoney
        except Exception:
            pass
        _http_patched = True


def _code6(value: object) -> str:
    text = str(value or "").strip()
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) >= 6:
        return digits[-6:]
    return digits.zfill(6) if digits else text


def _col(row: Mapping[str, object], *names: str) -> object:
    for name in names:
        if name in row:
            return row[name]
    return None


@dataclass
class AkshareMarketProvider:
    timeout: float | None = None

    def __post_init__(self) -> None:
        if self.timeout is None:
            self.timeout = float(settings.market_akshare_timeout_seconds)

    def fetch_index_quotes(self) -> list[IndexQuote]:
        import akshare as ak

        patch_akshare_http()
        try:
            frame = ak.stock_zh_index_spot_em(symbol="沪深重要指数")
            aligned = _align_index_frame(frame)
            if any(item.last is not None for item in aligned):
                return aligned
        except Exception:
            pass
        return _align_index_frame(ak.stock_zh_index_spot_sina())

    def fetch_stock_snapshots(self) -> list[StockQuote]:
        import akshare as ak
        import pandas as pd

        patch_akshare_http()
        rows: list[StockQuote] = []
        em_ok = False
        try:
            rows = _map_stock_frame(ak.stock_zh_a_spot_em())
            em_ok = True
        except Exception:
            rows = []
        if len(rows) >= MIN_STOCK_ROWS:
            return rows
        if em_ok:
            parts = []
            for fetcher in (ak.stock_sh_a_spot_em, ak.stock_sz_a_spot_em, ak.stock_bj_a_spot_em):
                try:
                    parts.append(fetcher())
                except Exception:
                    continue
            if parts:
                rows = _map_stock_frame(pd.concat(parts, ignore_index=True))
                if len(rows) >= MIN_STOCK_ROWS:
                    return rows
        try:
            fallback = _map_stock_frame(ak.stock_zh_a_spot())
        except Exception:
            fallback = []
        return fallback or rows

    def fetch_industry_boards(self) -> list[BoardQuote]:
        import akshare as ak

        patch_akshare_http()
        try:
            items = [_map_board_row(row.to_dict()) for _, row in ak.stock_board_industry_name_em().iterrows()]
            if items:
                return items
        except Exception:
            pass
        frame = ak.stock_board_industry_summary_ths()
        return [_map_board_row(row.to_dict()) for _, row in frame.iterrows()]


def _align_index_frame(frame: object) -> list[IndexQuote]:
    quotes = [_map_index_row(row.to_dict()) for _, row in frame.iterrows()]
    by_code = {item.code: item for item in quotes if item.code in CORE_INDEX_CODES}
    return [
        by_code.get(code, IndexQuote(code=code, name=INDEX_NAME_HINTS[code]))
        for code in CORE_INDEX_CODES
    ]


def _map_index_row(row: Mapping[str, object]) -> IndexQuote:
    code = _code6(_col(row, "代码", "code"))
    name = str(_col(row, "名称", "name") or INDEX_NAME_HINTS.get(code, code))
    return IndexQuote(
        code=code,
        name=name,
        last=_to_float(_col(row, "最新价", "last")),
        change_pct=_to_float(_col(row, "涨跌幅", "change_pct")),
        change_amt=_to_float(_col(row, "涨跌额", "change_amt")),
    )


def _map_stock_frame(frame: object) -> list[StockQuote]:
    if frame is None or getattr(frame, "empty", True):
        return []
    seen: set[str] = set()
    items: list[StockQuote] = []
    for _, row in frame.iterrows():
        quote = _map_stock_row(row.to_dict())
        if not quote.code or quote.code in seen:
            continue
        seen.add(quote.code)
        items.append(quote)
    return items


def _map_stock_row(row: Mapping[str, object]) -> StockQuote:
    return StockQuote(
        code=_code6(_col(row, "代码", "code")),
        name=str(_col(row, "名称", "name") or ""),
        last=_to_float(_col(row, "最新价", "last")),
        change_pct=_to_float(_col(row, "涨跌幅", "change_pct")),
        change_amt=_to_float(_col(row, "涨跌额", "change_amt")),
        amount=_to_float(_col(row, "成交额", "amount")),
        turnover=_to_float(_col(row, "换手率", "turnover")),
        pe=_to_float(_col(row, "市盈率-动态", "市盈率", "pe")),
    )


def _map_board_row(row: Mapping[str, object]) -> BoardQuote:
    name = str(_col(row, "板块名称", "板块", "name") or "").strip()
    code = str(_col(row, "板块代码", "code") or name).strip()
    return BoardQuote(
        code=code,
        name=name,
        change_pct=_to_float(_col(row, "涨跌幅", "change_pct")),
        lead_stock=str(_col(row, "领涨股票", "领涨股", "lead_stock") or "") or None,
        lead_change_pct=_to_float(
            _col(row, "领涨股票-涨跌幅", "领涨股-涨跌幅", "领涨股票涨跌幅", "lead_change_pct")
        ),
        up_count=_to_int(_col(row, "上涨家数", "up_count")),
        down_count=_to_int(_col(row, "下跌家数", "down_count")),
    )
