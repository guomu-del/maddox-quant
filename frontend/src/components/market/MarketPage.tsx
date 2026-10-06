"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { quickAddWatchlist } from "@/components/watchlist/WatchlistPanel";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { localizeError, useLocale } from "@/i18n/locale";
import type { Translate } from "@/i18n/locale";
import {
  fetchMarketBoards,
  fetchMarketOverview,
  fetchMarketStocks,
} from "@/lib/market-api";
import type {
  BoardListResponse,
  IndexQuote,
  MarketOverview,
  StockListResponse,
} from "@/types/market";

function changeClass(value: number | null | undefined): string {
  if (value == null || value === 0) return "text-zinc-600";
  return value > 0 ? "text-red-600" : "text-emerald-600";
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatNum(value: number | null | undefined, locale: string, digits = 2): string {
  if (value == null) return "—";
  return value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", { maximumFractionDigits: digits });
}

function formatAmount(value: number | null | undefined, t: Translate, locale: string): string {
  if (value == null) return "—";
  if (value >= 1e12) return t("market.unitTrillion", { n: (value / 1e12).toFixed(2) });
  if (value >= 1e8) return t("market.unitYi", { n: (value / 1e8).toFixed(2) });
  if (value >= 1e4) return t("market.unitWan", { n: (value / 1e4).toFixed(2) });
  return formatNum(value, locale, 0);
}

export function MarketPage() {
  const { locale, t } = useLocale();
  const indexPlaceholders: IndexQuote[] = [
    { code: "000001", name: t("market.sse"), last: null, change_pct: null, change_amt: null },
    { code: "399001", name: t("market.szse"), last: null, change_pct: null, change_amt: null },
    { code: "399006", name: t("market.chinext"), last: null, change_pct: null, change_amt: null },
    { code: "000300", name: t("market.csi300"), last: null, change_pct: null, change_amt: null },
  ];
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [boards, setBoards] = useState<BoardListResponse | null>(null);
  const [stocks, setStocks] = useState<StockListResponse | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("change_pct");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [watchMessage, setWatchMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadStatic() {
      try {
        const data = await fetchMarketOverview();
        if (!cancelled) {
          setOverview(data);
          setOverviewError(null);
        }
      } catch (err) {
        if (!cancelled) setOverviewError(localizeError(locale, err instanceof Error ? err.message : null, "market.indexLoadFailed"));
      }
      try {
        const data = await fetchMarketBoards();
        if (!cancelled) {
          setBoards(data);
          setBoardError(null);
        }
      } catch (err) {
        if (!cancelled) setBoardError(localizeError(locale, err instanceof Error ? err.message : null, "market.boardLoadFailed"));
      }
    }
    void loadStatic();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const loadStocks = useCallback(async () => {
    setStocksLoading(true);
    setStockError(null);
    try {
      const data = await fetchMarketStocks({ q: q || undefined, sort, order, page, page_size: 50 });
      setStocks(data);
    } catch (err) {
      setStockError(localizeError(locale, err instanceof Error ? err.message : null, "error.marketSlow"));
    } finally {
      setStocksLoading(false);
    }
  }, [q, sort, order, page, locale]);

  useEffect(() => {
    void loadStocks();
  }, [loadStocks]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void loadStocks();
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSort(field);
      setOrder("desc");
    }
    setPage(1);
  }

  async function watchStock(code: string, name: string) {
    try {
      await quickAddWatchlist({ target_type: "stock", target_code: code, target_name: name });
      setWatchMessage(t("watch.added", { name }));
    } catch (err) {
      setWatchMessage(localizeError(locale, err instanceof Error ? err.message : null, "watch.failed"));
    }
  }

  const totalPages = Math.max(1, Math.ceil((stocks?.total ?? 0) / 50));
  const gainers = boards?.items.filter((item) => (item.change_pct ?? 0) > 0).slice(0, 10) ?? [];
  const losers = [...(boards?.items ?? [])]
    .filter((item) => (item.change_pct ?? 0) < 0)
    .sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0))
    .slice(0, 10);
  const asOf = overview?.as_of || stocks?.as_of;
  const stale = overview?.stale || stocks?.stale || boards?.stale;

  return (
    <div className="space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t("market.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {t("market.disclaimer")}
          {asOf ? ` ${t("market.updatedAt", { time: new Date(asOf).toLocaleString(locale === "en" ? "en-US" : "zh-CN") })}` : ""}
          {overview?.is_trading ? ` · ${t("market.trading")}` : ` · ${t("market.closed")}`}
          {stale ? ` · ${t("market.stale")}` : ""}
        </p>
      </div>

      {overviewError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{overviewError}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-4">
        {(overview?.indices ?? (overviewError ? indexPlaceholders : [])).map((item) => (
          <div key={item.code} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-sm text-zinc-500">{item.name}</div>
            <div className={`mt-1 text-2xl font-semibold ${changeClass(item.change_pct)}`}>
              {formatNum(item.last, locale)}
            </div>
            <div className={`text-sm ${changeClass(item.change_pct)}`}>
              {item.last == null && item.change_pct == null ? t("common.na") : formatPct(item.change_pct)}
            </div>
          </div>
        ))}
      </div>

      {overview?.stats ? (
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-5">
          <div>
            {t("market.up")} <span className="font-medium text-red-600">{overview.stats.up_count}</span>
          </div>
          <div>
            {t("market.down")} <span className="font-medium text-emerald-600">{overview.stats.down_count}</span>
          </div>
          <div>{t("market.flat")} {overview.stats.flat_count}</div>
          <div>
            {t("market.limit", { up: overview.stats.limit_up_count, down: overview.stats.limit_down_count })}
          </div>
          <div>{t("market.turnover")} {formatAmount(overview.stats.total_amount, t, locale)}</div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <BoardColumn title={t("market.gainers")} items={gainers} error={boardError} />
        <BoardColumn title={t("market.losers")} items={losers} error={boardError} />
      </div>

      <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("market.searchPlaceholder")}
          className="h-10 flex-1 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
        />
        <button type="submit" className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white">
          {t("common.search")}
        </button>
      </form>
      {watchMessage ? <p className="text-xs text-emerald-600">{watchMessage}</p> : null}

      {stockError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{stockError}</p>
      ) : stocksLoading && !stocks ? (
        <ListSkeleton rows={8} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("code")}>
                    {t("market.code")}
                  </button>
                </th>
                <th className="px-3 py-2">{t("market.name")}</th>
                <th className="px-3 py-2">{t("market.last")}</th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("change_pct")}>
                    {t("market.changePct")}
                  </button>
                </th>
                <th className="px-3 py-2">{t("market.changeAmt")}</th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("amount")}>
                    {t("market.amount")}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("turnover")}>
                    {t("market.turnoverRate")}
                  </button>
                </th>
                <th className="px-3 py-2">{t("market.pe")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(stocks?.items ?? []).map((item) => (
                <tr key={item.code} className="border-t border-zinc-100">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/quant?code=${encodeURIComponent(item.code)}`} className="hover:underline">
                      {item.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{formatNum(item.last, locale)}</td>
                  <td className={`px-3 py-2 ${changeClass(item.change_pct)}`}>{formatPct(item.change_pct)}</td>
                  <td className={`px-3 py-2 ${changeClass(item.change_amt)}`}>{formatNum(item.change_amt, locale)}</td>
                  <td className="px-3 py-2">{formatAmount(item.amount, t, locale)}</td>
                  <td className="px-3 py-2">{item.turnover == null ? t("common.dash") : `${item.turnover.toFixed(2)}%`}</td>
                  <td className="px-3 py-2">{formatNum(item.pe, locale)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void watchStock(item.code, item.name)}
                      className="text-xs text-zinc-600 hover:text-zinc-900"
                    >
                      {t("common.watch")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && stocks ? (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            {t("common.prev")}
          </button>
          <span className="text-sm text-zinc-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            {t("common.next")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BoardColumn({
  title,
  items,
  error,
}: {
  title: string;
  items: NonNullable<BoardListResponse["items"]>;
  error: string | null;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.code || item.name} className="flex items-center justify-between">
            <span>{item.name}</span>
            <span className={changeClass(item.change_pct)}>{formatPct(item.change_pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
