"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { quickAddWatchlist } from "@/components/watchlist/WatchlistPanel";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
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

function formatNum(value: number | null | undefined, digits = 2): string {
  if (value == null) return "—";
  return value.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function formatAmount(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)} 万亿`;
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)} 亿`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(2)} 万`;
  return formatNum(value, 0);
}

const INDEX_PLACEHOLDERS: IndexQuote[] = [
  { code: "000001", name: "上证指数", last: null, change_pct: null, change_amt: null },
  { code: "399001", name: "深证成指", last: null, change_pct: null, change_amt: null },
  { code: "399006", name: "创业板指", last: null, change_pct: null, change_amt: null },
  { code: "000300", name: "沪深300", last: null, change_pct: null, change_amt: null },
];

export function MarketPage() {
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
        if (!cancelled) setOverviewError(err instanceof Error ? err.message : "指数加载失败");
      }
      try {
        const data = await fetchMarketBoards();
        if (!cancelled) {
          setBoards(data);
          setBoardError(null);
        }
      } catch (err) {
        if (!cancelled) setBoardError(err instanceof Error ? err.message : "板块加载失败");
      }
    }
    void loadStatic();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadStocks = useCallback(async () => {
    setStocksLoading(true);
    setStockError(null);
    try {
      const data = await fetchMarketStocks({ q: q || undefined, sort, order, page, page_size: 50 });
      setStocks(data);
    } catch (err) {
      setStockError(err instanceof Error ? err.message : "行情源响应较慢，请稍后重试");
    } finally {
      setStocksLoading(false);
    }
  }, [q, sort, order, page]);

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
      setWatchMessage(`已关注 ${name}`);
    } catch (err) {
      setWatchMessage(err instanceof Error ? err.message : "关注失败");
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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">行情</h1>
        <p className="mt-1 text-sm text-zinc-600">
          数据来自公开网页接口，约延迟 1–2 分钟，非交易所实时行情。
          {asOf ? ` 更新于 ${new Date(asOf).toLocaleString("zh-CN")}` : ""}
          {overview?.is_trading ? " · 交易时段" : " · 非交易时段"}
          {stale ? " · 显示缓存数据" : ""}
        </p>
      </div>

      {overviewError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{overviewError}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-4">
        {(overview?.indices ?? (overviewError ? INDEX_PLACEHOLDERS : [])).map((item) => (
          <div key={item.code} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-sm text-zinc-500">{item.name}</div>
            <div className={`mt-1 text-2xl font-semibold ${changeClass(item.change_pct)}`}>
              {formatNum(item.last)}
            </div>
            <div className={`text-sm ${changeClass(item.change_pct)}`}>
              {item.last == null && item.change_pct == null ? "暂无" : formatPct(item.change_pct)}
            </div>
          </div>
        ))}
      </div>

      {overview?.stats ? (
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-5">
          <div>
            上涨 <span className="font-medium text-red-600">{overview.stats.up_count}</span>
          </div>
          <div>
            下跌 <span className="font-medium text-emerald-600">{overview.stats.down_count}</span>
          </div>
          <div>平盘 {overview.stats.flat_count}</div>
          <div>
            涨停 {overview.stats.limit_up_count} / 跌停 {overview.stats.limit_down_count}
          </div>
          <div>成交额 {formatAmount(overview.stats.total_amount)}</div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <BoardColumn title="行业涨幅榜" items={gainers} error={boardError} />
        <BoardColumn title="行业跌幅榜" items={losers} error={boardError} />
      </div>

      <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索代码或名称"
          className="h-10 flex-1 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
        />
        <button type="submit" className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white">
          搜索
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
                    代码
                  </button>
                </th>
                <th className="px-3 py-2">名称</th>
                <th className="px-3 py-2">最新价</th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("change_pct")}>
                    涨跌幅
                  </button>
                </th>
                <th className="px-3 py-2">涨跌额</th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("amount")}>
                    成交额
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("turnover")}>
                    换手
                  </button>
                </th>
                <th className="px-3 py-2">市盈率</th>
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
                  <td className="px-3 py-2">{formatNum(item.last)}</td>
                  <td className={`px-3 py-2 ${changeClass(item.change_pct)}`}>{formatPct(item.change_pct)}</td>
                  <td className={`px-3 py-2 ${changeClass(item.change_amt)}`}>{formatNum(item.change_amt)}</td>
                  <td className="px-3 py-2">{formatAmount(item.amount)}</td>
                  <td className="px-3 py-2">{item.turnover == null ? "—" : `${item.turnover.toFixed(2)}%`}</td>
                  <td className="px-3 py-2">{formatNum(item.pe)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void watchStock(item.code, item.name)}
                      className="text-xs text-zinc-600 hover:text-zinc-900"
                    >
                      关注
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
            上一页
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
            下一页
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
