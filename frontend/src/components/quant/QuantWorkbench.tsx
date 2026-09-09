"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { BacktestPanel } from "@/components/quant/BacktestPanel";
import { QuantChart } from "@/components/quant/QuantChart";
import { TradePanel } from "@/components/quant/TradePanel";
import { quickAddWatchlist } from "@/components/watchlist/WatchlistPanel";
import { fetchStockKline, fetchStockQuote } from "@/lib/market-api";
import { fetchWatchlist } from "@/lib/watchlist-api";
import type { KlineResponse, StockQuote } from "@/types/market";
import type { WatchlistItem } from "@/types/watchlist";

type QuantTab = "quote" | "trade" | "backtest";

const TABS: { value: QuantTab; label: string }[] = [
  { value: "quote", label: "行情" },
  { value: "trade", label: "交易" },
  { value: "backtest", label: "回测" },
];

function changeClass(value: number | null): string {
  if (value == null || value === 0) return "text-zinc-600";
  return value > 0 ? "text-red-600" : "text-emerald-600";
}

function formatNumber(value: number | null): string {
  return value == null
    ? "—"
    : value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function QuantWorkbench() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim() ?? "";
  const requestedTab = searchParams.get("tab");
  const tab: QuantTab =
    requestedTab === "trade" || requestedTab === "backtest" ? requestedTab : "quote";

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [kline, setKline] = useState<KlineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMa, setShowMa] = useState(true);
  const [watchMessage, setWatchMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadWatchlist() {
      try {
        const items = await fetchWatchlist();
        if (!cancelled) {
          setWatchlist(items.filter((item) => item.target_type === "stock"));
          setWatchlistError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setWatchlistError(err instanceof Error ? err.message : "自选加载失败");
        }
      }
    }
    void loadWatchlist();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!code) return;

    async function loadMarketData() {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setQuote(null);
      setKline(null);
      try {
        const [nextQuote, nextKline] = await Promise.all([
          fetchStockQuote(code),
          fetchStockKline(code),
        ]);
        if (!cancelled) {
          setQuote(nextQuote);
          setKline(nextKline);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "行情加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMarketData();
    return () => {
      cancelled = true;
    };
  }, [code]);

  function navigate(next: { code?: string; tab?: QuantTab }) {
    const params = new URLSearchParams();
    const nextCode = next.code ?? code;
    const nextTab = next.tab ?? tab;
    if (nextCode !== code) setWatchMessage(null);
    if (nextCode) params.set("code", nextCode);
    params.set("tab", nextTab);
    router.replace(`/quant?${params.toString()}`);
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCode = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    if (nextCode) navigate({ code: nextCode });
  }

  async function watchStock() {
    if (!quote) return;
    try {
      await quickAddWatchlist({
        target_type: "stock",
        target_code: quote.code,
        target_name: quote.name,
      });
      setWatchMessage(`已关注 ${quote.name}`);
    } catch (err) {
      setWatchMessage(err instanceof Error ? err.message : "关注失败");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">量化工作台</h1>
        <p className="mt-1 text-sm text-zinc-600">仿真，非实盘</p>
      </div>

      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-6" aria-label="量化页签">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => navigate({ tab: item.value })}
              className={`border-b-2 px-1 pb-3 text-sm font-medium ${
                tab === item.value
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <form onSubmit={onSearch} className="rounded-xl border border-zinc-200 bg-white p-4">
            <label htmlFor="quant-code" className="text-sm font-semibold">
              股票代码
            </label>
            <div className="mt-3 flex gap-2">
              <input
                key={code}
                id="quant-code"
                name="code"
                defaultValue={code}
                placeholder="如 600519"
                className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white"
              >
                搜索
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold">股票自选</h2>
            {watchlistError ? (
              <p className="mt-3 text-sm text-red-600">{watchlistError}</p>
            ) : watchlist.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">暂无股票自选</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {watchlist.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate({ code: item.target_code })}
                      className={`w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-100 ${
                        code === item.target_code ? "bg-zinc-100 font-medium" : ""
                      }`}
                    >
                      <span className="block">{item.target_name || item.target_code}</span>
                      <span className="text-xs text-zinc-500">{item.target_code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {tab === "trade" ? (
            <TradePanel code={code} quote={quote} />
          ) : tab === "backtest" ? (
            <BacktestPanel code={code} />
          ) : !code ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-24 text-center text-zinc-500">
              搜索或从自选打开标的
            </div>
          ) : loading ? (
            <div className="rounded-xl border border-zinc-200 bg-white py-24 text-center text-zinc-500">
              行情加载中…
            </div>
          ) : error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : quote ? (
            <>
              <header className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {quote.name} <span className="text-sm font-normal text-zinc-500">{quote.code}</span>
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">仿真，非实盘</p>
                  </div>
                  <div className={`text-right ${changeClass(quote.change_pct)}`}>
                    <div className="text-3xl font-semibold">{formatNumber(quote.last)}</div>
                    <div className="text-sm">{formatPct(quote.change_pct)}</div>
                  </div>
                </div>
              </header>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px]">
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">日 K</h3>
                    <label className="flex items-center gap-2 text-sm text-zinc-600">
                      <input
                        type="checkbox"
                        checked={showMa}
                        onChange={(event) => setShowMa(event.target.checked)}
                      />
                      MA
                    </label>
                  </div>
                  {kline && kline.items.length > 0 ? (
                    <QuantChart items={kline.items} showMa={showMa} />
                  ) : (
                    <p className="py-24 text-center text-sm text-zinc-500">暂无日 K 数据</p>
                  )}
                  {kline?.stale ? (
                    <p className="mt-2 text-xs text-amber-600">当前显示缓存数据</p>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
                  <Link
                    href={`/reports?q=${encodeURIComponent(quote.code)}`}
                    className="block rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm hover:bg-zinc-50"
                  >
                    查看研报
                  </Link>
                  <Link
                    href={`/analysis/stock/${encodeURIComponent(quote.code)}`}
                    className="block rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm hover:bg-zinc-50"
                  >
                    个股分析
                  </Link>
                  <button
                    type="button"
                    onClick={() => void watchStock()}
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    关注
                  </button>
                  {watchMessage ? (
                    <p className="text-center text-xs text-zinc-600">{watchMessage}</p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
