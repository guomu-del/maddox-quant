"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { localizeError, useLocale } from "@/i18n/locale";
import {
  fetchBacktest,
  fetchBacktests,
  fetchBacktestStrategies,
  submitBacktest,
} from "@/lib/quant-api";
import type { BacktestRun, BacktestStrategy } from "@/types/quant";

function inputDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function defaultDates(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 3);
  return { start: inputDate(start), end: inputDate(end) };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function BacktestPanel({ code }: { code: string }) {
  const { locale, t } = useLocale();
  const dates = defaultDates();
  const [strategies, setStrategies] = useState<BacktestStrategy[]>([]);
  const [strategyId, setStrategyId] = useState("dual_ma");
  const [params, setParams] = useState<Record<string, number>>({ fast: 5, slow: 20 });
  const [start, setStart] = useState(dates.start);
  const [end, setEnd] = useState(dates.end);
  const [cash, setCash] = useState("1000000");
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [run, setRun] = useState<BacktestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function number(value: number): string {
    return value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", { maximumFractionDigits: 2 });
  }

  function strategyLabel(id: string, fallback?: string): string {
    if (id === "dual_ma") return t("quant.dualMa");
    if (id === "breakout") return t("quant.breakout");
    return fallback ?? id;
  }

  const loadHistory = useCallback(async () => {
    const nextRuns = await fetchBacktests(20);
    setRuns(nextRuns);
    return nextRuns;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextStrategies, nextRuns] = await Promise.all([
          fetchBacktestStrategies(),
          loadHistory(),
        ]);
        if (!cancelled) {
          setStrategies(nextStrategies);
          setRun(nextRuns[0] ?? null);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(localizeError(locale, err instanceof Error ? err.message : null, "quant.historyFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  function changeStrategy(nextId: string) {
    setStrategyId(nextId);
    const strategy = strategies.find((item) => item.id === nextId);
    if (strategy) setParams(strategy.params);
  }

  async function runBacktest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const nextRun = await submitBacktest({
        code,
        strategy_id: strategyId,
        params,
        start,
        end,
        cash: Number(cash),
      });
      setRun(nextRun);
      await loadHistory();
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "quant.runFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function openRun(id: number) {
    setError(null);
    try {
      setRun(await fetchBacktest(id));
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "quant.historyFailed"));
    }
  }

  const metricItems = run?.metrics
    ? [
        [t("quant.totalReturn"), percent(run.metrics.total_return)],
        [t("quant.annualReturn"), percent(run.metrics.annual_return)],
        [t("quant.maxDrawdown"), percent(run.metrics.max_drawdown)],
        [t("quant.winRate"), percent(run.metrics.win_rate)],
        [t("quant.profitFactor"), number(run.metrics.profit_factor)],
        [t("quant.tradeCount"), String(run.metrics.trade_count)],
      ]
    : [];

  const strategyOptions = strategies.length
    ? strategies
    : [{ id: "dual_ma", name: t("quant.dualMa"), params: { fast: 5, slow: 20 } }];

  return (
    <div className="space-y-4">
      <form onSubmit={runBacktest} className="rounded-xl border border-zinc-200 bg-white p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {t("quant.backtestHint")}
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {t("quant.ctaBacktest")}{" "}
            <span className="text-sm font-normal text-zinc-500">{code || t("quant.noStock")}</span>
          </h2>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">{t("quant.strategy")}</span>
            <select
              value={strategyId}
              onChange={(event) => changeStrategy(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3"
            >
              {strategyOptions.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategyLabel(strategy.id, strategy.name)}
                </option>
              ))}
            </select>
          </label>
          {Object.entries(params).map(([key, value]) => (
            <label key={`${strategyId}-${key}`} className="text-sm">
              <span className="mb-1 block text-zinc-600">{t("quant.param", { key })}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={value}
                onChange={(event) =>
                  setParams((current) => ({ ...current, [key]: Number(event.target.value) }))
                }
                className="h-10 w-full rounded-lg border border-zinc-300 px-3"
              />
            </label>
          ))}
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">{t("quant.startDate")}</span>
            <input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 px-3"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">{t("quant.endDate")}</span>
            <input
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 px-3"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">{t("quant.initCash")}</span>
            <input
              type="number"
              min="1"
              step="10000"
              value={cash}
              onChange={(event) => setCash(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 px-3"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!code || submitting || Number(cash) <= 0}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? t("quant.backtestRunning") : t("quant.runBacktest")}
          </button>
          {!code ? <span className="text-sm text-amber-700">{t("quant.pickCode")}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </form>

      {run ? (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold">{t("quant.equityCurve")}</h3>
            {run.equity?.length ? (
              <div className="mt-4 h-80">
                <ResponsiveContainer>
                  <LineChart data={run.equity}>
                    <CartesianGrid stroke="#f4f4f5" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={28} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => number(Number(value))} />
                    <Line type="monotone" dataKey="value" name={t("quant.equityName")} stroke="#18181b" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-zinc-500">{t("quant.noEquity")}</p>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold">{t("quant.metrics")}</h3>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {metricItems.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-zinc-100 px-4 py-3">
                  <dt className="text-xs text-zinc-500">{label}</dt>
                  <dd className="mt-1 text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold">{t("quant.backtestTrades")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">{t("quant.date")}</th><th className="px-4 py-3">{t("quant.side")}</th>
                    <th className="px-4 py-3">{t("quant.fillPrice")}</th><th className="px-4 py-3">{t("quant.qtyCol")}</th>
                    <th className="px-4 py-3">{t("quant.fees")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(run.trades ?? []).map((trade, index) => (
                    <tr key={`${trade.date}-${trade.side}-${index}`}>
                      <td className="px-4 py-3">{trade.date}</td>
                      <td className="px-4 py-3">{trade.side === "buy" ? t("quant.buy") : t("quant.sell")}</td>
                      <td className="px-4 py-3">{number(trade.price)}</td>
                      <td className="px-4 py-3">{trade.quantity}</td>
                      <td className="px-4 py-3">{number(trade.commission + trade.stamp_tax)}</td>
                    </tr>
                  ))}
                  {!run.trades?.length ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">{t("quant.noTrades")}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500">
          {t("quant.historyLoading")}
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold">{t("quant.recentBacktests")}</h3>
        {runs.length ? (
          <ul className="mt-3 divide-y divide-zinc-100">
            {runs.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openRun(item.id)}
                  className="flex w-full items-center justify-between gap-4 py-3 text-left text-sm hover:text-zinc-600"
                >
                  <span>
                    {item.code} · {strategyLabel(item.strategy_id)} · {item.start} {t("quant.rangeTo")} {item.end}
                  </span>
                  <span className="shrink-0 text-zinc-500">
                    {item.metrics ? percent(item.metrics.total_return) : t("common.dash")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">{t("quant.noBacktests")}</p>
        )}
      </section>
    </div>
  );
}
