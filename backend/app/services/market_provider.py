from __future__ import annotations

import logging
import random
import threading
import time
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date as date_cls
from urllib.parse import urlparse, urlunparse

import requests

from app.core.config import settings
from app.schemas.market import BoardQuote, IndexQuote, KlineBar, StockQuote

logger = logging.getLogger(__name__)

CORE_INDEX_CODES = ("000001", "399001", "399006", "000300")
MIN_STOCK_ROWS = 2000
TENCENT_QUOTE_URL = "https://qt.gtimg.cn/q={symbols}"
TENCENT_BATCH_SIZE = 60
TENCENT_WORKERS = 8
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
            return _attach_tencent_metrics(rows)
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
                    return _attach_tencent_metrics(rows)
        try:
            fallback = _map_stock_frame(ak.stock_zh_a_spot())
        except Exception:
            fallback = []
        return _attach_tencent_metrics(fallback or rows)

    def fetch_daily_bars(self, code: str, *, start=None, end=None, limit: int = 250):
        import akshare as ak

        patch_akshare_http()
        start_s = start.strftime("%Y%m%d") if start else "19700101"
        end_s = end.strftime("%Y%m%d") if end else "20991231"
        frame = None
        try:
            frame = ak.stock_zh_a_hist(
                symbol=code, period="daily", start_date=start_s, end_date=end_s, adjust="qfq"
            )
        except Exception:
            frame = None
        if frame is None or getattr(frame, "empty", True):
            try:
                frame = ak.stock_zh_a_daily(symbol=_daily_symbol(code), adjust="qfq")
            except Exception:
                frame = None
        bars = _map_kline_frame(frame)
        if start:
            bars = [b for b in bars if b.date >= start]
        if end:
            bars = [b for b in bars if b.date <= end]
        if limit and len(bars) > limit:
            bars = bars[-limit:]
        return bars

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
        volume=_to_float(_col(row, "成交量", "volume")),
        open=_to_float(_col(row, "今开", "open")),
        high=_to_float(_col(row, "最高", "high")),
        low=_to_float(_col(row, "最低", "low")),
        prev_close=_to_float(_col(row, "昨收", "prev_close")),
    )


def _quote_symbol(code: str) -> str:
    if code.startswith(("4", "8")) or code.startswith("92"):
        return f"bj{code}"
    if code.startswith(("6", "9")):
        return f"sh{code}"
    return f"sz{code}"


def _parse_tencent_quote(line: str) -> tuple[str, float | None, float | None] | None:
    if "pv_none_match" in line or '="' not in line:
        return None
    body = line.split('="', 1)[1].rstrip('";\r\n')
    parts = body.split("~")
    if len(parts) < 40:
        return None
    code = _code6(parts[2])
    if not code:
        return None
    return code, _to_float(parts[38]), _to_float(parts[39])


def _fetch_tencent_batch(codes: list[str]) -> dict[str, tuple[float | None, float | None]]:
    if not codes:
        return {}
    symbols = ",".join(_quote_symbol(code) for code in codes)
    response = _original_requests_get(
        TENCENT_QUOTE_URL.format(symbols=symbols),
        timeout=15,
        headers={
            "User-Agent": _BROWSER_HEADERS["User-Agent"],
            "Referer": "https://finance.qq.com/",
        },
    )
    response.raise_for_status()
    text = response.content.decode("gbk", errors="replace")
    extras: dict[str, tuple[float | None, float | None]] = {}
    for line in text.splitlines():
        parsed = _parse_tencent_quote(line)
        if parsed is None:
            continue
        extras[parsed[0]] = (parsed[1], parsed[2])
    return extras


def _fetch_tencent_metrics(codes: list[str]) -> dict[str, tuple[float | None, float | None]]:
    extras: dict[str, tuple[float | None, float | None]] = {}
    batches = [codes[index : index + TENCENT_BATCH_SIZE] for index in range(0, len(codes), TENCENT_BATCH_SIZE)]
    if not batches:
        return extras
    workers = min(TENCENT_WORKERS, len(batches))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_fetch_tencent_batch, batch) for batch in batches]
        for future in as_completed(futures):
            try:
                extras.update(future.result())
            except Exception:
                logger.exception("tencent quote batch failed")
    return extras


def _attach_tencent_metrics(rows: list[StockQuote]) -> list[StockQuote]:
    missing = [item.code for item in rows if item.turnover is None or item.pe is None]
    if not missing:
        return rows
    try:
        extras = _fetch_tencent_metrics(missing)
    except Exception:
        logger.exception("tencent quote fill failed")
        return rows
    if not extras:
        return rows
    for item in rows:
        extra = extras.get(item.code)
        if extra is None:
            continue
        turnover, pe = extra
        if item.turnover is None:
            item.turnover = turnover
        if item.pe is None:
            item.pe = pe
    return rows


def _daily_symbol(code: str) -> str:
    if code.startswith(("6", "9")):
        return f"sh{code}"
    if code.startswith(("8", "4")):
        return f"bj{code}"
    return f"sz{code}"


def _map_kline_frame(frame: object) -> list[KlineBar]:
    if frame is None or getattr(frame, "empty", True):
        return []
    items: list[KlineBar] = []
    for _, row in frame.iterrows():
        raw = row.to_dict()
        day = _col(raw, "日期", "date")
        if day is None:
            continue
        if hasattr(day, "date"):
            day = day.date()
        elif not isinstance(day, date_cls):
            text = str(day)[:10]
            day = date_cls.fromisoformat(text.replace("/", "-"))
        items.append(
            KlineBar(
                date=day,
                open=float(_to_float(_col(raw, "开盘", "open")) or 0),
                high=float(_to_float(_col(raw, "最高", "high")) or 0),
                low=float(_to_float(_col(raw, "最低", "low")) or 0),
                close=float(_to_float(_col(raw, "收盘", "close")) or 0),
                volume=_to_float(_col(raw, "成交量", "volume")),
                amount=_to_float(_col(raw, "成交额", "amount")),
            )
        )
    items.sort(key=lambda b: b.date)
    return items


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
