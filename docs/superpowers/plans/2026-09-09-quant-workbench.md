# Quant Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not commit unless the user asks.

**Goal:** Add `/quant` with three tabs — daily K-line workbench, paper trading blotter, and CTA backtest — using AKShare on demand and Neon for the paper ledger only.

**Architecture:** Extend `MarketProvider` with daily bars behind the existing TTL cache. `PaperBroker` persists one paper account, orders, fills, and positions in Postgres and matches against snapshot `last`. `CtaBacktester` walks daily bars with two built-in strategies and writes `backtest_runs`. Next.js `/quant` is a client workbench; routes never `import akshare`.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, AKShare, pytest (mocked provider), Next.js App Router, TypeScript, Tailwind, Recharts.

**Spec:** `docs/superpowers/specs/2026-09-09-quant-workbench-design.md`

## Global Constraints

- Paper trading only; no live gateway, no 「实盘」 toggle, no broker secrets.
- One global paper account (no auth), A-share long-only, 6-digit stock codes.
- API field names English (`change_pct`, `side`, `order_type`).
- Quotes and K-lines: request-time AKShare + in-process TTL; do not persist bars.
- Paper ledger and backtest runs must persist in Postgres/Neon.
- Routes must not `import akshare`.
- Tests mock the market provider; do not hit Eastmoney.
- Backtests must not mutate paper positions or cash.
- Strategies are built-in only; do not execute user Python.
- DeepSeek is not used for orders or backtests.
- `/market` remains the market-wide board.
- UI: zinc cards, red up / green down, copy 「仿真，非实盘」.
- Do not git commit unless the user asks (skip every Commit step).
- `pytest` `client`/`db_session` fixtures downgrade the connected database; do not run those against production Neon unless you accept a wipe. Prefer mocked unit tests; API tests only on a disposable DB.

## File map

Create:

- `backend/app/services/trading_fees.py`
- `backend/app/models/paper.py`
- `backend/app/models/backtest.py`
- `backend/app/schemas/paper.py`
- `backend/app/schemas/backtest.py`
- `backend/app/services/paper_broker.py`
- `backend/app/services/cta_strategies.py`
- `backend/app/services/cta_backtester.py`
- `backend/app/api/routes/paper.py`
- `backend/app/api/routes/quant.py`
- `backend/alembic/versions/007_create_paper_and_backtest.py`
- `backend/tests/test_trading_fees.py`
- `backend/tests/test_paper_broker.py`
- `backend/tests/test_paper_api.py`
- `backend/tests/test_cta_backtester.py`
- `backend/tests/test_quant_api.py`
- `frontend/src/types/quant.ts`
- `frontend/src/lib/paper-api.ts`
- `frontend/src/lib/quant-api.ts`
- `frontend/src/app/quant/page.tsx`
- `frontend/src/components/quant/QuantWorkbench.tsx`
- `frontend/src/components/quant/QuantChart.tsx`
- `frontend/src/components/quant/TradePanel.tsx`
- `frontend/src/components/quant/BacktestPanel.tsx`

Modify:

- `backend/app/core/config.py` — `market_kline_ttl_seconds: int = 600`
- `backend/app/schemas/market.py` — `KlineBar`, `KlineResponse`
- `backend/app/services/market_provider.py` — `fetch_daily_bars`
- `backend/app/services/market_service.py` — `get_stock`, `get_kline`; extend `MarketSource`
- `backend/app/api/routes/market.py` — `GET /stocks/{code}`, `GET /stocks/{code}/kline`
- `backend/app/models/__init__.py` and `backend/alembic/env.py` — new models
- `backend/app/main.py` — register paper + quant routers
- `backend/tests/test_market_service.py` — FakeProvider grows `fetch_daily_bars`
- `backend/tests/test_market_api.py` — stock quote + kline
- `.env.example` — `MARKET_KLINE_TTL_SECONDS=600`
- `frontend/src/lib/market-api.ts` — `fetchStockQuote`, `fetchStockKline`
- `frontend/src/types/market.ts` — kline types
- `frontend/src/components/SiteHeader.tsx` — 量化
- `frontend/src/app/page.tsx` — home card
- `frontend/src/components/market/MarketPage.tsx` — code link to `/quant?code=`

---

### Task 1: Daily bars and single-stock quote API

**Files:**

- Modify: `backend/app/core/config.py`
- Modify: `.env.example`
- Modify: `backend/app/schemas/market.py`
- Modify: `backend/app/services/market_provider.py`
- Modify: `backend/app/services/market_service.py`
- Modify: `backend/app/api/routes/market.py`
- Modify: `backend/tests/test_market_service.py`
- Test: `backend/tests/test_market_api.py`

**Interfaces:**

- Consumes: existing `TtlCache`, `AkshareMarketProvider`, `StockQuote`, `_load`, `AppError`
- Produces:
  - `KlineBar(date: date, open: float, high: float, low: float, close: float, volume: float | None, amount: float | None)`
  - `KlineResponse(code: str, items: list[KlineBar], as_of: datetime, stale: bool)`
  - `MarketSource.fetch_daily_bars(code: str, *, start: date | None, end: date | None, limit: int) -> list[KlineBar]`
  - `get_stock(code: str, provider: MarketSource | None = None) -> StockQuote`
  - `get_kline(code: str, *, limit: int = 250, start: date | None = None, end: date | None = None, provider: MarketSource | None = None) -> KlineResponse`

- [ ] **Step 1: Write failing service tests**

Add to FakeProvider in `backend/tests/test_market_service.py`:

```python
from datetime import date

from app.schemas.market import KlineBar

    def fetch_daily_bars(self, code: str, *, start=None, end=None, limit: int = 250):
        bars = [
            KlineBar(date=date(2026, 1, 5), open=10, high=11, low=9.5, close=10.5, volume=1000, amount=10500),
            KlineBar(date=date(2026, 1, 6), open=10.5, high=12, low=10.4, close=11.8, volume=1200, amount=14000),
        ]
        return bars[:limit]


def test_get_stock_from_snapshot():
    quote = market_service.get_stock("600519", provider=FakeProvider())
    assert quote.code == "600519"
    assert quote.name == "贵州茅台"


def test_get_stock_rejects_bad_code():
    from app.core.errors import AppError

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec -T -e PYTHONPATH=/app backend pytest tests/test_market_service.py::test_get_stock_from_snapshot tests/test_market_service.py::test_get_kline_returns_bars -v`

Expected: FAIL (`get_stock` / `get_kline` not defined, or FakeProvider missing `fetch_daily_bars`)

- [ ] **Step 3: Add config and schemas**

In `backend/app/core/config.py` add `market_kline_ttl_seconds: int = 600`.

In `.env.example` add `MARKET_KLINE_TTL_SECONDS=600`.

In `backend/app/schemas/market.py` add:

```python
from datetime import date, datetime

class KlineBar(BaseModel):
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None
    amount: float | None = None


class KlineResponse(BaseModel):
    code: str
    items: list[KlineBar]
    as_of: datetime
    stale: bool
```

- [ ] **Step 4: Implement provider `fetch_daily_bars`**

Append to `AkshareMarketProvider` (lazy-import akshare; call `patch_akshare_http()` first):

```python
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
```

Add helpers in the same file:

```python
from datetime import date as date_cls

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
```

Import `KlineBar` in `market_provider.py`.

- [ ] **Step 5: Implement service + routes**

Extend `MarketSource` with `fetch_daily_bars`. Add `_kline_cache = TtlCache(ttl_seconds=settings.market_kline_ttl_seconds)` next to `_cache`.

```python
import re
from datetime import date

CODE_RE = re.compile(r"^\d{6}$")


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
        return source.fetch_daily_bars(code, start=start, end=end, limit=limit)

    try:
        items, stale = _kline_cache.get_or_load(key, loader)
    except Exception as exc:
        logger.exception("kline load failed for %s", code)
        raise AppError("行情源暂时不可用", code="market_source_error", status_code=502) from exc
    return KlineResponse(code=code, items=items, as_of=datetime.now(SHANGHAI), stale=stale)
```

Register routes **after** `GET /stocks` list:

```python
from datetime import date

from app.schemas.market import KlineResponse, StockQuote

@router.get("/stocks/{code}/kline", response_model=KlineResponse)
def market_stock_kline(
    code: str,
    limit: int = Query(250, ge=1, le=800),
    start: date | None = None,
    end: date | None = None,
):
    return market_service.get_kline(code, limit=limit, start=start, end=end)


@router.get("/stocks/{code}", response_model=StockQuote)
def market_stock_quote(code: str):
    return market_service.get_stock(code)
```

- [ ] **Step 6: API tests with FakeProvider**

In `test_market_api.py`, add `fetch_daily_bars` to FakeProvider (copy the method from Step 1 onto `tests/test_market_service.py` FakeProvider — API tests import that class).

```python
def test_market_stock_quote_and_kline(client, monkeypatch):
    market_service.reset_market_cache_for_tests(TtlCache(ttl_seconds=30))
    monkeypatch.setattr(market_service, "_provider", FakeProvider())
    monkeypatch.setattr(market_service, "_kline_cache", TtlCache(ttl_seconds=30))
    quote = client.get("/api/market/stocks/600519")
    assert quote.status_code == 200
    assert quote.json()["code"] == "600519"
    kline = client.get("/api/market/stocks/600519/kline", params={"limit": 10})
    assert kline.status_code == 200
    assert len(kline.json()["items"]) == 2
    bad = client.get("/api/market/stocks/12")
    assert bad.status_code == 400
    assert bad.json()["code"] == "invalid_stock_code"
```

If `_kline_cache` is not reset, add `reset_market_cache_for_tests` to also replace `_kline_cache`.

- [ ] **Step 7: Run tests**

Run: `docker compose exec -T -e PYTHONPATH=/app backend pytest tests/test_market_service.py tests/test_market_api.py tests/test_market_provider.py tests/test_ttl_cache.py -v`

Expected: PASS

- [ ] **Step 8: Commit** (skip unless the user asked)

---

### Task 2: `/quant` quote tab UI

**Files:**

- Modify: `frontend/src/types/market.ts`
- Modify: `frontend/src/lib/market-api.ts`
- Create: `frontend/src/app/quant/page.tsx`
- Create: `frontend/src/components/quant/QuantChart.tsx`
- Create: `frontend/src/components/quant/QuantWorkbench.tsx` (quote tab working; trade/backtest placeholders)
- Modify: `frontend/src/components/SiteHeader.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/market/MarketPage.tsx`

**Interfaces:**

- Consumes: `GET /api/market/stocks/{code}`, `GET /api/market/stocks/{code}/kline`, `fetchWatchlist` / `quickAddWatchlist`
- Produces: `/quant?code=&tab=quote|trade|backtest`

- [ ] **Step 1: Extend market client**

`frontend/src/types/market.ts`:

```typescript
export interface KlineBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  amount: number | null;
}

export interface KlineResponse {
  code: string;
  items: KlineBar[];
  as_of: string;
  stale: boolean;
}
```

In `market-api.ts`:

```typescript
export async function fetchStockQuote(code: string): Promise<StockQuote> {
  return marketFetch<StockQuote>(`/api/market/stocks/${encodeURIComponent(code)}`);
}

export async function fetchStockKline(code: string, limit = 250): Promise<KlineResponse> {
  return marketFetch<KlineResponse>(
    `/api/market/stocks/${encodeURIComponent(code)}/kline?limit=${limit}`,
  );
}
```

Also import `StockQuote` and `KlineResponse` in that file.

- [ ] **Step 2: Chart component**

Create `frontend/src/components/quant/QuantChart.tsx` using existing `recharts` (already in `package.json`):

```tsx
"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { KlineBar } from "@/types/market";

function sma(items: KlineBar[], n: number): (number | null)[] {
  return items.map((_, i) => {
    if (i + 1 < n) return null;
    const slice = items.slice(i + 1 - n, i + 1);
    return slice.reduce((s, b) => s + b.close, 0) / n;
  });
}

export function QuantChart({ items, showMa }: { items: KlineBar[]; showMa: boolean }) {
  const ma5 = sma(items, 5);
  const ma10 = sma(items, 10);
  const ma20 = sma(items, 20);
  const data = items.map((bar, i) => ({
    date: bar.date.slice(5),
    close: bar.close,
    volume: bar.volume,
    ma5: ma5[i],
    ma10: ma10[i],
    ma20: ma20[i],
  }));
  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#f4f4f5" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="price" domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar yAxisId="vol" dataKey="volume" fill="#d4d4d8" />
          <Line yAxisId="price" type="monotone" dataKey="close" stroke="#18181b" dot={false} />
          {showMa ? (
            <>
              <Line yAxisId="price" type="monotone" dataKey="ma5" stroke="#ef4444" dot={false} />
              <Line yAxisId="price" type="monotone" dataKey="ma10" stroke="#f59e0b" dot={false} />
              <Line yAxisId="price" type="monotone" dataKey="ma20" stroke="#2563eb" dot={false} />
            </>
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

(Close line + volume + MA is acceptable for v1 if candlesticks are too heavy; do not add new chart libraries.)

- [ ] **Step 3: Workbench shell + quote tab**

`frontend/src/app/quant/page.tsx`:

```tsx
import { QuantWorkbench } from "@/components/quant/QuantWorkbench";

export default function QuantRoute() {
  return <QuantWorkbench />;
}
```

`QuantWorkbench.tsx` must:

- Read `code` and `tab` from `useSearchParams` (`tab` default `quote`).
- Tabs: 行情 / 交易 / 回测; switching writes `?tab=&code=` via `router.replace`.
- Left: search input that on submit sets `code`; list `fetchWatchlist()` filtered `target_type === "stock"`; click sets code.
- Header: name, last, `change_pct` with red/green; subtitle `仿真，非实盘`.
- Quote tab: `QuantChart`; MA checkbox; right links `/reports?q=`, `/analysis/stock/{code}`; 关注 via `quickAddWatchlist`.
- Empty: 「搜索或从自选打开标的」.
- Error: show message, do not render a fake chart.
- Trade/backtest tabs: temporary `<p>交易页签将在后续任务接入</p>` until Tasks 4–5.

Use the same fetch timeout helper as market-api (90s).

- [ ] **Step 4: Nav, home, market links**

`SiteHeader.tsx` navItems insert `{ href: "/quant", label: "量化" }` after 行情.

`page.tsx` modules insert:

```tsx
{ title: "量化", description: "仿真交易、日 K 与 CTA 回测", href: "/quant" },
```

In `MarketPage.tsx` change the code `Link` from `/reports?q=` to `/quant?code=${encodeURIComponent(item.code)}`. Keep 关注 as-is.

- [ ] **Step 5: Rebuild frontend and smoke**

Run: `docker compose up --build -d frontend`

Open `http://localhost:4321/quant?code=600519` — chart or explicit error; nav shows 量化; market row code goes to `/quant`.

- [ ] **Step 6: Commit** (skip unless asked)

---

### Task 3: Trading fees and PaperBroker

**Files:**

- Create: `backend/app/services/trading_fees.py`
- Create: `backend/app/models/paper.py`
- Create: `backend/alembic/versions/007_create_paper_and_backtest.py` (paper tables only is OK; include `backtest_runs` empty-ready in the same migration to avoid two deploys — see columns in spec §8)
- Create: `backend/app/schemas/paper.py`
- Create: `backend/app/services/paper_broker.py`
- Create: `backend/app/api/routes/paper.py`
- Modify: `backend/app/models/__init__.py`, `backend/alembic/env.py`, `backend/app/main.py`
- Test: `backend/tests/test_trading_fees.py`, `backend/tests/test_paper_broker.py`, `backend/tests/test_paper_api.py`

**Interfaces:**

- Consumes: `get_stock` for `last`/`name`; `AppError`; SQLAlchemy session
- Produces:
  - `commission(amount: float) -> float` = `max(amount * 0.0003, 5)`
  - `stamp_tax(side: str, amount: float) -> float` = `amount * 0.0005` if `side == "sell"` else `0`
  - `PaperBroker.place_order(db, *, code, side, order_type, price, quantity) -> PaperOrder`
  - `cancel_order`, `get_account`, `list_positions`, `list_orders`, `list_trades`, `reset_account`, `match_pending`
  - HTTP under `/api/paper/...` as spec §6.4

- [ ] **Step 1: Fee tests**

`backend/tests/test_trading_fees.py`:

```python
from app.services.trading_fees import commission, stamp_tax


def test_commission_floor():
    assert commission(1000) == 5
    assert commission(100_000) == 30


def test_stamp_tax_sell_only():
    assert stamp_tax("buy", 10_000) == 0
    assert stamp_tax("sell", 10_000) == 5
```

Run: `docker compose exec -T -e PYTHONPATH=/app backend pytest tests/test_trading_fees.py -v`

Expected: FAIL (module missing)

- [ ] **Step 2: Implement fees**

```python
COMMISSION_RATE = 0.0003
COMMISSION_MIN = 5.0
STAMP_TAX_RATE = 0.0005


def commission(amount: float) -> float:
    return max(amount * COMMISSION_RATE, COMMISSION_MIN)


def stamp_tax(side: str, amount: float) -> float:
    return amount * STAMP_TAX_RATE if side == "sell" else 0.0
```

Run the same pytest command. Expected: PASS

- [ ] **Step 3: Models + migration**

`paper.py` models exactly as spec §8. `PaperAccount.id` primary key. Seed account id=1 in migration:

```python
op.execute(
    "INSERT INTO paper_accounts (id, cash, frozen, starting_cash) VALUES (1, 1000000, 0, 1000000)"
)
```

`backtest_runs` in the same revision (`007_create_paper_and_backtest`, `down_revision="006_add_report_tables"`).

Export models in `__init__.py` and import them in `alembic/env.py`.

- [ ] **Step 4: Broker unit tests (in-memory SQLite is not used; use Fake session or SQLAlchemy with the test `db_session`)**

`test_paper_broker.py` should not need Eastmoney: inject a quote getter.

Design `PaperBroker` constructor:

```python
class PaperBroker:
    def __init__(self, get_quote):
        self._get_quote = get_quote  # Callable[[str], StockQuote]
```

Module-level `broker = PaperBroker(get_quote=market_service.get_stock)`.

Tests:

```python
def _quote(code: str) -> StockQuote:
    last = {"600519": 100.0, "000001": 10.0}.get(code)
    return StockQuote(code=code, name="测试", last=last)


def test_market_buy_fills_and_debits(db_session):
    from app.services.paper_broker import PaperBroker
    from app.models.paper import PaperAccount

    acct = db_session.get(PaperAccount, 1) or PaperAccount(id=1, cash=1_000_000, frozen=0, starting_cash=1_000_000)
    if acct not in db_session:
        db_session.add(acct)
        db_session.commit()
    pb = PaperBroker(get_quote=_quote)
    order = pb.place_order(db_session, code="600519", side="buy", order_type="market", price=None, quantity=100)
    assert order.status == "filled"
    db_session.refresh(acct)
    assert acct.cash < 1_000_000
    pos = pb.list_positions(db_session)[0]
    assert pos.quantity == 100


def test_limit_buy_stays_pending(db_session):
    pb = PaperBroker(get_quote=_quote)
    order = pb.place_order(db_session, code="600519", side="buy", order_type="limit", price=90, quantity=100)
    assert order.status == "pending"


def test_limit_buy_fills_when_last_crosses(db_session):
    prices = {"600519": 100.0}

    def quote(code):
        return StockQuote(code=code, name="测试", last=prices[code])

    pb = PaperBroker(get_quote=quote)
    order = pb.place_order(db_session, code="600519", side="buy", order_type="limit", price=90, quantity=100)
    assert order.status == "pending"
    prices["600519"] = 89
    pb.match_pending(db_session)
    db_session.refresh(order)
    assert order.status == "filled"


def test_cancel_releases_frozen(db_session):
    pb = PaperBroker(get_quote=_quote)
    order = pb.place_order(db_session, code="600519", side="buy", order_type="limit", price=90, quantity=100)
    frozen_before = db_session.get(PaperAccount, 1).frozen
    assert frozen_before > 0
    pb.cancel_order(db_session, order.id)
    assert db_session.get(PaperAccount, 1).frozen == 0


def test_buy_lot_must_be_100(db_session):
    from app.core.errors import AppError
    pb = PaperBroker(get_quote=_quote)
    try:
        pb.place_order(db_session, code="600519", side="buy", order_type="market", price=None, quantity=50)
        raise AssertionError("expected AppError")
    except AppError as exc:
        assert exc.code == "invalid_lot"
```

`db_session` fixture upgrades then **downgrades to base** after the test — migration `007` must be `head` for these tests to see tables. After `006` only, add `007` so `command.upgrade(head)` creates paper tables.

- [ ] **Step 5: Implement PaperBroker matching exactly as spec §6.3**

Rules to copy, not reinterpret:

- Market buy/sell: fill at `last`; no `last` → status `rejected`, `reject_reason` set, do not freeze.
- Limit buy fills iff `last <= price`; limit sell iff `last >= price`; fill price is `last`.
- Buy quantity multiple of 100; sell may be odd lot.
- Buy cash check uses `ref_price` (`last` or limit `price`) plus `commission(qty * ref_price)`.
- Sell cannot exceed position quantity (`insufficient_position`).
- Freeze on pending buy = `qty * price` (limit) or `qty * last` (market, usually fills immediately). After fill: unfreeze reserved, debit `qty * last + commission + stamp_tax`.
- Average cost on buy: `new_cost = old_cost + qty * last`; on sell reduce `cost_amount` pro-rata; delete row at 0 qty.
- `cancel_order`: only `pending`, else `order_not_cancellable` 409; release freeze on buy.
- `reset_account`: delete orders/trades/positions for account 1; cash=`starting_cash`; frozen=0.
- `get_account`: `equity = cash + frozen + sum(qty * (last or cost_px))`.

Ensure account id=1 exists (`_ensure_account(db)`).

- [ ] **Step 6: Routes**

`backend/app/api/routes/paper.py` prefix `/api/paper`. Depend `get_db`. Call `match_pending` at the start of `get_account`, `list_orders`, `list_positions`.

Register in `main.py`: `app.include_router(paper_router)`.

- [ ] **Step 7: API tests**

Monkeypatch `paper_broker` module-level broker `get_quote` to `_quote`. Use `client` + `db_session`. Cover: POST market buy 200 filled; POST limit 90 pending; GET positions; POST cancel; POST reset cash 1_000_000.

- [ ] **Step 8: Run**

`docker compose exec -T -e PYTHONPATH=/app backend pytest tests/test_trading_fees.py tests/test_paper_broker.py tests/test_paper_api.py -v`

Expected: PASS

Then: `docker compose exec -T backend alembic upgrade head` on the running Neon/local DB.

- [ ] **Step 9: Commit** (skip unless asked)

---

### Task 4: Trade tab UI

**Files:**

- Create: `frontend/src/types/quant.ts` (paper types)
- Create: `frontend/src/lib/paper-api.ts`
- Create: `frontend/src/components/quant/TradePanel.tsx`
- Modify: `frontend/src/components/quant/QuantWorkbench.tsx` — render `TradePanel` when `tab=trade`

**Interfaces:**

- Consumes: paper REST from Task 3; `fetchStockQuote`
- Produces: user-visible paper blotter

- [ ] **Step 1: Client**

```typescript
// paper-api.ts
export async function fetchPaperAccount() { return json("/api/paper/account"); }
export async function resetPaperAccount() { return json("/api/paper/account/reset", { method: "POST" }); }
export async function fetchPositions() { return json("/api/paper/positions"); }
export async function fetchOrders(params?: { status?: string; code?: string }) { /* query */ }
export async function fetchTrades(code?: string) { /* query */ }
export async function submitOrder(body: {
  code: string; side: "buy" | "sell"; order_type: "market" | "limit"; price: number | null; quantity: number;
}) { return json("/api/paper/orders", { method: "POST", body: JSON.stringify(body) }); }
export async function cancelOrder(id: number) {
  return json(`/api/paper/orders/${id}/cancel`, { method: "POST" });
}
```

Reuse `parseApiError`. Types in `quant.ts`: `PaperAccount`, `PaperOrder`, `PaperTrade`, `PaperPosition`.

- [ ] **Step 2: TradePanel**

Must include:

- Banner: 仿真，非实盘
- Account line: 现金 / 冻结 / 总权益
- Form: side, order_type, optional price (disabled unless limit), quantity, submit
- Current code from workbench props `{ code, quote }`
- Tables: orders (cancel button if pending), trades, positions
- Reset button with `confirm("将清空委托、成交与持仓，现金恢复为100万")`
- On submit error, show `err.message` (insufficient_cash etc. already in API detail)
- After successful order, reload account/positions/orders/trades
- Poll account every 30s while tab is visible so pending limits can fill after snapshot moves (GET account runs `match_pending`)

- [ ] **Step 3: Wire tab and rebuild frontend**

Smoke: buy 100 shares market on a code with last price; cash drops; position appears; reset restores 1,000,000.

- [ ] **Step 4: Commit** (skip unless asked)

---

### Task 5: CTA engine, API, backtest tab

**Files:**

- Create: `backend/app/models/backtest.py` (if not already in Task 3 migration)
- Create: `backend/app/schemas/backtest.py`
- Create: `backend/app/services/cta_strategies.py`
- Create: `backend/app/services/cta_backtester.py`
- Create: `backend/app/api/routes/quant.py`
- Create: `backend/tests/test_cta_backtester.py`
- Create: `backend/tests/test_quant_api.py`
- Create: `frontend/src/lib/quant-api.ts`
- Create: `frontend/src/components/quant/BacktestPanel.tsx`
- Modify: `QuantWorkbench.tsx`, `main.py`, model imports

**Interfaces:**

- Consumes: `fetch_daily_bars` / `get_kline`; `commission` / `stamp_tax`; does **not** import PaperBroker
- Produces:
  - `STRATEGIES = [{"id": "dual_ma", "name": "双均线", "params": {"fast": 5, "slow": 20}}, {"id": "breakout", "name": "唐奇安突破", "params": {"n": 20}}]`
  - `run_backtest(*, code, strategy_id, params, start, end, cash, bars) -> BacktestRun`
  - `POST /api/quant/backtests`, `GET /api/quant/backtests?limit=20`, `GET /api/quant/backtests/{id}`, `GET /api/quant/strategies`

- [ ] **Step 1: Dual-MA golden-cross test**

Synthetic bars: 30 days, closes `10,10,...,10` then rise so MA5 crosses MA20 from below. Assert:

- first fill `side == "buy"`
- fill price equals **next bar open** (not the signal bar close)
- `paper` tables unchanged if a PaperAccount exists (count trades still 0)

```python
from datetime import date, timedelta
from app.schemas.market import KlineBar
from app.services.cta_backtester import run_backtest


def _bars():
    start = date(2024, 1, 2)
    closes = [10.0] * 25 + [10.2, 10.4, 10.8, 11.5, 12.0, 12.2]
    out = []
    for i, c in enumerate(closes):
        d = start + timedelta(days=i)
        out.append(KlineBar(date=d, open=c - 0.05, high=c + 0.1, low=c - 0.1, close=c, volume=1, amount=c))
    return out


def test_dual_ma_buys_next_open():
    result = run_backtest(
        code="600519",
        strategy_id="dual_ma",
        params={"fast": 5, "slow": 20},
        start=date(2024, 1, 2),
        end=date(2024, 3, 1),
        cash=1_000_000,
        bars=_bars(),
    )
    buys = [t for t in result.trades if t["side"] == "buy"]
    assert buys
    signal_index = next(i for i, b in enumerate(_bars()) if b.date == date.fromisoformat(buys[0]["date"]) or True)
    # fill date is the bar AFTER the crossover bar; price == that bar's open
    assert buys[0]["price"] == buys[0]["price"]  # replaced in implementation with exact open
```

Replace the weak last assert: compute crossover index in the test by running the same MA logic or inspect `buys[0]["price"]` equals the open of the bar whose date is the fill date, and that fill date is strictly after the first bar where fast MA > slow MA.

```python
    fill_date = date.fromisoformat(buys[0]["date"])
    by_date = {b.date: b for b in _bars()}
    assert buys[0]["price"] == by_date[fill_date].open
```

- [ ] **Step 2: Run test FAIL** then implement strategies + engine

`cta_strategies.py`:

```python
def dual_ma_signal(closes: list[float], fast: int, slow: int) -> str | None:
    if len(closes) < slow + 1:
        return None
    def ma(n, series):
        return sum(series[-n:]) / n
    prev_fast, prev_slow = ma(fast, closes[:-1]), ma(slow, closes[:-1])
    cur_fast, cur_slow = ma(fast, closes), ma(slow, closes)
    if prev_fast <= prev_slow and cur_fast > cur_slow:
        return "buy"
    if prev_fast >= prev_slow and cur_fast < cur_slow:
        return "sell"
    return None


def breakout_signal(highs: list[float], lows: list[float], closes: list[float], n: int) -> str | None:
    if len(closes) < n + 1:
        return None
    window_high = max(highs[-(n + 1):-1])
    window_low = min(lows[-(n + 1):-1])
    if closes[-1] > window_high:
        return "buy"
    if closes[-1] < window_low:
        return "sell"
    return None
```

Engine loop: for i, bar in enumerate(bars): compute signal on `bars[:i+1]` only; if signal, set `pending_intent`; on next bar, execute at `bar.open` (full cash buy rounded down to 100 shares, or sell all). Skip if last bar. Track cash, position, equity each day (mark at close). Fees via `trading_fees`. Do not touch paper models.

Metrics:

- `total_return = equity[-1]/cash - 1`
- `annual_return = (1 + total_return) ** (365 / max(days, 1)) - 1`
- `max_drawdown` from running peak on equity
- `win_rate` on round-trips (buy then sell); 0 if none
- `profit_factor` = gross profit / gross loss (0 if no loss)
- `trade_count` = number of fills

Persist `BacktestRun` with `status="ok"` or on source failure do not insert a successful row.

- [ ] **Step 3: HTTP API**

`POST /api/quant/backtests` loads bars via `market_service.get_kline(code, start=start, end=end, limit=800)` then `run_backtest`. Default dates: `end=today Asia/Shanghai`, `start=end - 3 years`. Unknown `strategy_id` → 400 `invalid_strategy`.

`GET /api/quant/strategies` returns the two catalog entries.

`GET /api/quant/backtests?limit=20` newest first.

`GET /api/quant/backtests/{id}` 404 if missing.

Register router `/api/quant`.

API test: monkeypatch `get_kline` to return `_bars()`; POST dual_ma; assert 200, `trades` not written to `paper_trades` (count 0).

- [ ] **Step 4: BacktestPanel**

Form: strategy select, param inputs (fast/slow or n), start/end, cash, submit. Copy: 「回测不影响仿真账户」. Chart: Recharts `LineChart` on `equity`. Table of metrics + trades. List last 20 runs, click loads `GET /{id}`.

- [ ] **Step 5: Run tests + UI smoke**

`docker compose exec -T -e PYTHONPATH=/app backend pytest tests/test_cta_backtester.py tests/test_quant_api.py tests/test_paper_broker.py -v`

Expected: PASS

Browser: `/quant?tab=backtest&code=600519` run dual_ma; equity chart or trade_count 0 with empty-state; `/quant?tab=trade` positions unchanged.

Rebuild frontend. Verify `/market` and a report detail PDF preview still work (no file picker / blank iframe regression).

- [ ] **Step 6: Commit** (skip unless asked)

---

## Spec coverage

| Spec section | Task |
|--------------|------|
| §4 `/quant` tabs, nav, `/market` link | 2, 4, 5 |
| §5 quote + kline APIs, cache, 6-digit | 1 |
| §6 paper account, matching, fees, REST | 3, 4 |
| §7 CTA strategies, next-open fill, isolation, persist | 5 |
| §8 tables | 3 |
| §10 error codes + mocked tests | 1, 3, 5 |
| §11 acceptance | 2, 4, 5 smoke |
| 实盘 | none (explicitly out) |

## Placeholder scan

None of TBD / “handle edge cases” / “similar to Task N” remain; fee rates, lot size, and fill rules are copied from the spec.
