"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { quickAddWatchlist } from "@/components/watchlist/WatchlistPanel";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LIST_PAGE_SIZE, PageToolbar } from "@/components/ui/PageToolbar";
import { localizeError, useLocale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
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

function formatAmount(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  return formatMoneyCompact(value, locale);
}

const SORTABLE_COLUMNS: { field: string; labelKey: MessageKey }[] = [
  { field: "code", labelKey: "market.code" },
  { field: "name", labelKey: "market.name" },
  { field: "last", labelKey: "market.last" },
  { field: "change_pct", labelKey: "market.changePct" },
  { field: "change_amt", labelKey: "market.changeAmt" },
  { field: "open", labelKey: "market.open" },
  { field: "high", labelKey: "market.high" },
  { field: "low", labelKey: "market.low" },
  { field: "prev_close", labelKey: "market.prevClose" },
  { field: "volume", labelKey: "market.volume" },
  { field: "amount", labelKey: "market.amount" },
  { field: "turnover", labelKey: "market.turnoverRate" },
  { field: "pe", labelKey: "market.pe" },
];

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
  const listRef = useRef<HTMLDivElement>(null);
  const loadSeq = useRef(0);
  const skipListScroll = useRef(true);

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
    const requestId = ++loadSeq.current;
    setStocksLoading(true);
    setStockError(null);
    try {
      const data = await fetchMarketStocks({
        q: q || undefined,
        sort,
        order,
        page,
        page_size: LIST_PAGE_SIZE,
      });
      if (requestId !== loadSeq.current) return;
      setStocks(data);
    } catch (err) {
      if (requestId !== loadSeq.current) return;
      setStockError(localizeError(locale, err instanceof Error ? err.message : null, "error.marketSlow"));
    } finally {
      if (requestId === loadSeq.current) setStocksLoading(false);
    }
  }, [q, sort, order, page, locale]);

  useEffect(() => {
    void loadStocks();
  }, [loadStocks]);

  useEffect(() => {
    if (skipListScroll.current) {
      skipListScroll.current = false;
      return;
    }
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void loadStocks();
  }

  function toggleSort(field: string) {
    if (sort === field) {
      if (order === "desc") {
        setOrder("asc");
      } else {
        setSort("default");
        setOrder("desc");
      }
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
          <div>{t("market.turnover")} {formatAmount(overview.stats.total_amount, locale)}</div>
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

      <div ref={listRef} className="scroll-mt-16 space-y-3">
        {stockError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{stockError}</p>
        ) : stocksLoading ? (
          <ListSkeleton rows={LIST_PAGE_SIZE} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr>
                  {SORTABLE_COLUMNS.map((column) => (
                    <SortableHeader
                      key={column.field}
                      field={column.field}
                      label={t(column.labelKey)}
                      sort={sort}
                      order={order}
                      onToggle={toggleSort}
                    />
                  ))}
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
                    <td className="px-3 py-2">{item.last == null ? t("common.dash") : formatMoney(item.last, locale)}</td>
                    <td className={`px-3 py-2 ${changeClass(item.change_pct)}`}>{formatPct(item.change_pct)}</td>
                    <td className={`px-3 py-2 ${changeClass(item.change_amt)}`}>
                      {item.change_amt == null ? t("common.dash") : formatMoney(item.change_amt, locale)}
                    </td>
                    <td className="px-3 py-2">{item.open == null ? t("common.dash") : formatMoney(item.open, locale)}</td>
                    <td className="px-3 py-2">{item.high == null ? t("common.dash") : formatMoney(item.high, locale)}</td>
                    <td className="px-3 py-2">{item.low == null ? t("common.dash") : formatMoney(item.low, locale)}</td>
                    <td className="px-3 py-2">
                      {item.prev_close == null ? t("common.dash") : formatMoney(item.prev_close, locale)}
                    </td>
                    <td className="px-3 py-2">{item.volume == null ? t("common.dash") : formatNum(item.volume, locale, 0)}</td>
                    <td className="px-3 py-2">{formatAmount(item.amount, locale)}</td>
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

        {stocks && stocks.total > LIST_PAGE_SIZE ? (
          <PageToolbar page={page} totalItems={stocks.total} onPageChange={setPage} />
        ) : null}
      </div>
    </div>
  );
}

function SortableHeader({
  field,
  label,
  sort,
  order,
  onToggle,
}: {
  field: string;
  label: string;
  sort: string;
  order: "asc" | "desc";
  onToggle: (field: string) => void;
}) {
  const { t } = useLocale();
  const active = sort === field;
  const state = !active ? t("market.sortDefault") : order === "asc" ? t("market.sortAsc") : t("market.sortDesc");
  return (
    <th className="px-3 py-2" aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onToggle(field)}
        title={`${label} · ${t("market.sortCycle")}`}
        aria-label={`${label}, ${state}`}
        className={`inline-flex items-center gap-1 hover:text-zinc-900 ${active ? "font-medium text-zinc-900" : ""}`}
      >
        {label}
        <span className={`text-[10px] leading-none ${active ? "text-zinc-700" : "text-zinc-300"}`} aria-hidden>
          {active ? (order === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
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
