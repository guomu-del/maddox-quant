# A-Share Market Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not commit unless the user asks.

**Goal:** Add `/market` showing A-share indices, market stats, industry boards, and a searchable stock table by calling AKShare on demand with in-process TTL cache.

**Architecture:** FastAPI `MarketProvider` wraps AKShare. A thread-safe TTL cache with single-flight sits in front of the provider. Routes only read the cache/service layer. Next.js `/market` consumes three JSON APIs. No new Postgres tables, no scheduler jobs.

**Tech Stack:** FastAPI, Pydantic, AKShare, pytest (mocked provider), Next.js App Router, TypeScript, Tailwind.

## Global Constraints

- Approach A: request-triggered AKShare; process memory TTL only; no snapshot tables; no Redis; no APScheduler market jobs.
- Stock codes are 6-digit strings, matching watchlist `target_code`.
- API field names are English (`change_pct`, not `涨跌幅`).
- Routes must not `import akshare`.
- Tests mock the provider; do not hit Eastmoney.
- Existing report/analysis/watchlist behavior must not regress.
- Do not git commit unless the user asks.
- UI: zinc cards, A-share colors (red up, green down).
- Cache TTL default 90s; AKShare timeout default 75s.

## File map

Create:
- `backend/app/core/ttl_cache.py`
- `backend/app/services/market_provider.py`
- `backend/app/services/market_service.py`
- `backend/app/schemas/market.py`
- `backend/app/api/routes/market.py`
- `backend/tests/test_ttl_cache.py`
- `backend/tests/test_market_service.py`
- `backend/tests/test_market_api.py`
- `frontend/src/types/market.ts`
- `frontend/src/lib/market-api.ts`
- `frontend/src/app/market/page.tsx`
- `frontend/src/components/market/MarketPage.tsx`

Modify:
- `backend/app/core/config.py`
- `backend/app/main.py`
- `backend/requirements.txt`
- `.env.example`
- `frontend/src/components/SiteHeader.tsx`
- `frontend/src/app/page.tsx`

---

### Task 1: TTL cache with single-flight

**Files:**
- Create: `backend/app/core/ttl_cache.py`
- Test: `backend/tests/test_ttl_cache.py`

**Produces:**
- `class TtlCache`
- `get(key: str) -> Any | None` — fresh value only
- `get_stale(key: str) -> Any | None` — expired but present
- `set(key: str, value: Any) -> None`
- `get_or_load(key: str, loader: Callable[[], T]) -> tuple[T, bool]` — second bool is `stale`

- [ ] Write failing tests for miss, hit, expiry, stale fallback, single-flight (one loader call under concurrency)
- [ ] Implement `TtlCache` with `threading.Lock` and `threading.Event`
- [ ] Run: `PYTHONPATH=. pytest tests/test_ttl_cache.py -v` → pass

---

### Task 2: Config and dependency

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/requirements.txt`
- Modify: `.env.example`

**Produces:** `settings.market_cache_ttl_seconds: int = 90`, `settings.market_akshare_timeout_seconds: int = 75`

- [ ] Add the two settings and `akshare>=1.16.0` to requirements
- [ ] Add env keys to `.env.example` (no secrets)

---

### Task 3: Schemas, provider, service, API

**Files:** listed in file map (backend market_*)

**Produces API:**
- `GET /api/market/overview` → indices, stats, as_of, stale, is_trading
- `GET /api/market/stocks?q=&sort=&order=&page=&page_size=`
- `GET /api/market/boards?type=industry`

**Index codes:** `000001`, `399001`, `399006`, `000300`

**Limit-up/down heuristic:** `change_pct >= 9.8` / `<= -9.8`

**Provider:**
- `fetch_index_quotes()` uses `stock_zh_index_spot_em`
- `fetch_stock_snapshots()` uses `stock_zh_a_spot_em`; if rows < 2000, concatenate sh/sz/bj spot
- `fetch_industry_boards()` uses `stock_board_industry_name_em`
- Map Chinese dataframe columns to English models; coerce code to 6 digits

**Service:**
- Cache keys: `indices`, `stocks`, `boards`
- Overview stats computed from cached stock snapshots
- `is_trading`: weekday 9:15–15:10 Asia/Shanghai (ignore holidays in v1)
- On loader failure: return stale if present else raise `AppError` 502 `market_source_error`

- [ ] Tests with FakeProvider: overview stats, stock search/sort/page, cache reuse (loader called once), 502 without stale, 200 stale=true with expired cache + failing loader
- [ ] Implement provider/service/routes; register router in `main.py`
- [ ] Run: `PYTHONPATH=. pytest tests/test_market_service.py tests/test_market_api.py tests/test_ttl_cache.py -v` then full `tests/`

---

### Task 4: Frontend market page

**Files:** frontend market_* plus SiteHeader and home

**Behavior:**
- Load overview, boards, stocks in parallel; stocks fetch timeout 90s
- Red/green by sign of `change_pct`
- Stock code → `/reports?q={code}`; 关注 button via `quickAddWatchlist`
- Show `as_of` and stale warning
- Skeleton while stocks loading; error copy: 「行情源响应较慢，请稍后重试」

- [ ] Implement types, api client, `MarketPage`, `/market` route, nav + home card
- [ ] Rebuild frontend Docker image and smoke `/market`

---

### Task 5: Verify

- [ ] Backend tests all pass
- [ ] `curl` overview/stocks/boards (may be slow first hit if live AKShare works)
- [ ] Browser: `/market` shows layout; search/pagination; no file-picker regressions on reports
