"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageToolbar, pageSlice } from "@/components/ui/PageToolbar";
import { localizeError, useLocale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  fetchBacktest,
  fetchBacktests,
  fetchBacktestStrategies,
  submitBacktest,
} from "@/lib/quant-api";
import type { BacktestEquityPoint, BacktestRun, BacktestStrategy } from "@/types/quant";

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

function maxDrawdownRange(equity: BacktestEquityPoint[]): {
  peak: BacktestEquityPoint;
  trough: BacktestEquityPoint;
} | null {
  let peakValue = Number.NEGATIVE_INFINITY;
  let peakIndex = 0;
  let maxDrawdown = 0;
  let troughIndex = 0;
  let drawdownPeakIndex = 0;
  equity.forEach((point, index) => {
    if (point.value >= peakValue) {
      peakValue = point.value;
      peakIndex = index;
    }
    if (peakValue > 0) {
      const drawdown = (peakValue - point.value) / peakValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        troughIndex = index;
        drawdownPeakIndex = peakIndex;
      }
    }
  });
  if (maxDrawdown <= 0 || drawdownPeakIndex === troughIndex) return null;
  return { peak: equity[drawdownPeakIndex], trough: equity[troughIndex] };
}

function compareToHold(run: BacktestRun): { excess: number; winner: "strategy" | "hold" | "tie" } | null {
  if (typeof run.metrics?.excess_return === "number" && run.metrics.winner) {
    const winner =
      run.metrics.winner === "strategy" || run.metrics.winner === "hold" ? run.metrics.winner : "tie";
    return { excess: run.metrics.excess_return, winner };
  }
  const last = run.equity?.at(-1);
  if (!last || last.hold == null || !(run.cash > 0)) return null;
  const excess = (last.value - last.hold) / run.cash;
  const winner = excess > 0 ? "strategy" : excess < 0 ? "hold" : "tie";
  return { excess, winner };
}

const FIELD_CLASS = "h-8 w-full rounded-md border border-zinc-300 px-2 text-sm";
const DECIMAL_PARAM_KEYS = new Set(["entry_z", "k", "m", "entry"]);
const PARAM_LABELS: Record<string, MessageKey> = {
  fast: "quant.pFast",
  slow: "quant.pSlow",
  n: "quant.pN",
  signal: "quant.pSignal",
  lookback: "quant.pLookback",
  entry_z: "quant.pEntryZ",
  entry_n: "quant.pEntryN",
  exit_n: "quant.pExitN",
  k: "quant.pK",
  m: "quant.pM",
  oversold: "quant.pOversold",
  overbought: "quant.pOverbought",
  entry: "quant.pEntry",
  low: "quant.pLow",
  high: "quant.pHigh",
};
const STRATEGY_GUIDES: Record<string, { logic: MessageKey; params: MessageKey; example: MessageKey }> = {
  dual_ma: { logic: "quant.guideDualMaLogic", params: "quant.guideDualMaParams", example: "quant.guideDualMaExample" },
  breakout: { logic: "quant.guideBreakoutLogic", params: "quant.guideBreakoutParams", example: "quant.guideBreakoutExample" },
  trend: { logic: "quant.guideTrendLogic", params: "quant.guideTrendParams", example: "quant.guideTrendExample" },
  mean_reversion: { logic: "quant.guideMeanReversionLogic", params: "quant.guideMeanReversionParams", example: "quant.guideMeanReversionExample" },
  multi_factor: { logic: "quant.guideMultiFactorLogic", params: "quant.guideMultiFactorParams", example: "quant.guideMultiFactorExample" },
  pairs: { logic: "quant.guidePairsLogic", params: "quant.guidePairsParams", example: "quant.guidePairsExample" },
  macd: { logic: "quant.guideMacdLogic", params: "quant.guideMacdParams", example: "quant.guideMacdExample" },
  turtle: { logic: "quant.guideTurtleLogic", params: "quant.guideTurtleParams", example: "quant.guideTurtleExample" },
  bollinger: { logic: "quant.guideBollingerLogic", params: "quant.guideBollingerParams", example: "quant.guideBollingerExample" },
  rsi: { logic: "quant.guideRsiLogic", params: "quant.guideRsiParams", example: "quant.guideRsiExample" },
  bias: { logic: "quant.guideBiasLogic", params: "quant.guideBiasParams", example: "quant.guideBiasExample" },
  kdj: { logic: "quant.guideKdjLogic", params: "quant.guideKdjParams", example: "quant.guideKdjExample" },
  atr: { logic: "quant.guideAtrLogic", params: "quant.guideAtrParams", example: "quant.guideAtrExample" },
};

function MetricHint({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-400 text-[10px] font-semibold leading-none text-zinc-500 hover:border-zinc-700 hover:text-zinc-800 focus:border-zinc-700 focus:outline-none"
        aria-label={text}
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-1 w-56 rounded-md bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
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
  const [commissionPct, setCommissionPct] = useState("0.03");
  const [commissionMin, setCommissionMin] = useState("5");
  const [stampTaxPct, setStampTaxPct] = useState("0.05");
  const [pairCode, setPairCode] = useState("");
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [run, setRun] = useState<BacktestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradePage, setTradePage] = useState(1);

  function number(value: number): string {
    return formatNumber(value, locale);
  }

  function money(value: number): string {
    return formatMoney(value, locale);
  }

  function strategyLabel(id: string, fallback?: string): string {
    if (id === "dual_ma") return t("quant.dualMa");
    if (id === "breakout") return t("quant.breakout");
    if (id === "trend") return t("quant.trend");
    if (id === "mean_reversion") return t("quant.meanReversion");
    if (id === "multi_factor") return t("quant.multiFactor");
    if (id === "pairs") return t("quant.pairs");
    if (id === "macd") return t("quant.macd");
    if (id === "turtle") return t("quant.turtle");
    if (id === "bollinger") return t("quant.bollinger");
    if (id === "rsi") return t("quant.rsi");
    if (id === "bias") return t("quant.bias");
    if (id === "kdj") return t("quant.kdj");
    if (id === "atr") return t("quant.atr");
    return fallback ?? id;
  }

  const cashAmount = Number(cash);
  const cashValid = Number.isFinite(cashAmount) && cashAmount > 0;
  const commissionRate = Number(commissionPct) / 100;
  const commissionFloor = Number(commissionMin);
  const stampTaxRate = Number(stampTaxPct) / 100;
  const feesValid =
    Number.isFinite(commissionRate) &&
    commissionRate >= 0 &&
    Number.isFinite(commissionFloor) &&
    commissionFloor >= 0 &&
    Number.isFinite(stampTaxRate) &&
    stampTaxRate >= 0;
  const pairReady = strategyId !== "pairs" || /^\d{6}$/.test(pairCode.trim());
  const strategyParamEntries = Object.entries(params).filter(
    ([key]) => !["pair_code", "commission_rate", "commission_min", "stamp_tax_rate"].includes(key),
  );

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

  useEffect(() => {
    setTradePage(1);
  }, [run?.id]);

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
        cash: cashAmount,
        commission_rate: commissionRate,
        commission_min: commissionFloor,
        stamp_tax_rate: stampTaxRate,
        ...(strategyId === "pairs" ? { pair_code: pairCode.trim() } : {}),
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

  const comparison = run ? compareToHold(run) : null;
  const drawdownRange = run?.equity?.length ? maxDrawdownRange(run.equity) : null;
  const totalFees = run
    ? typeof run.metrics?.total_fees === "number"
      ? run.metrics.total_fees
      : (run.trades ?? []).reduce((sum, trade) => sum + trade.commission + trade.stamp_tax, 0)
    : 0;
  const winnerItem =
    comparison?.winner === "strategy"
      ? { text: t("quant.winnerStrategy"), className: "text-red-600" }
      : comparison?.winner === "hold"
        ? { text: t("quant.winnerHold"), className: "text-emerald-600" }
        : { text: t("quant.winnerTie"), className: "text-zinc-700" };
  const metricItems = run?.metrics
    ? [
        { label: t("quant.totalReturn"), value: percent(run.metrics.total_return), hint: t("quant.hintTotalReturn") },
        {
          label: t("quant.winner"),
          value: comparison ? winnerItem.text : t("common.dash"),
          hint: t("quant.hintWinner"),
          valueClass: comparison ? winnerItem.className : undefined,
        },
        {
          label: t("quant.excessReturn"),
          value: comparison ? percent(comparison.excess) : t("common.dash"),
          hint: t("quant.hintExcessReturn"),
          valueClass:
            comparison == null
              ? undefined
              : comparison.excess > 0
                ? "text-red-600"
                : comparison.excess < 0
                  ? "text-emerald-600"
                  : "text-zinc-700",
        },
        { label: t("quant.annualReturn"), value: percent(run.metrics.annual_return), hint: t("quant.hintAnnualReturn") },
        { label: t("quant.maxDrawdown"), value: percent(run.metrics.max_drawdown), hint: t("quant.hintMaxDrawdown") },
        { label: t("quant.winRate"), value: percent(run.metrics.win_rate), hint: t("quant.hintWinRate") },
        { label: t("quant.profitFactor"), value: number(run.metrics.profit_factor), hint: t("quant.hintProfitFactor") },
        { label: t("quant.tradeCount"), value: String(run.metrics.trade_count), hint: t("quant.hintTradeCount") },
        { label: t("quant.totalFees"), value: money(totalFees), hint: t("quant.hintTotalFees") },
      ]
    : [];

  const strategyOptions = strategies.length
    ? strategies
    : [{ id: "dual_ma", name: t("quant.dualMa"), params: { fast: 5, slow: 20 } }];

  return (
    <div className="space-y-4">
      <form onSubmit={runBacktest} className="rounded-xl border border-zinc-200 bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {t("quant.backtestHint")}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {t("quant.ctaBacktest")}{" "}
            <span className="text-sm font-normal text-zinc-500">{code || t("quant.noStock")}</span>
          </h2>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="block text-xs">
              <span className="mb-0.5 block text-zinc-600">{t("quant.strategy")}</span>
              <select
                value={strategyId}
                onChange={(event) => changeStrategy(event.target.value)}
                className={`${FIELD_CLASS} bg-white`}
              >
                {strategyOptions.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategyLabel(strategy.id, strategy.name)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {strategyParamEntries.map(([key, value]) => {
                const decimal = DECIMAL_PARAM_KEYS.has(key);
                return (
                  <label key={`${strategyId}-${key}`} className="block text-xs">
                    <span className="mb-0.5 block text-zinc-600">
                      {PARAM_LABELS[key] ? t(PARAM_LABELS[key]) : t("quant.param", { key })}
                    </span>
                    <input
                      type="number"
                      min={decimal ? "0.01" : "1"}
                      step={decimal ? "any" : "1"}
                      value={value}
                      onChange={(event) =>
                        setParams((current) => ({ ...current, [key]: Number(event.target.value) }))
                      }
                      className={FIELD_CLASS}
                    />
                  </label>
                );
              })}
              {strategyId === "pairs" ? (
                <label className="col-span-2 block text-xs">
                  <span className="mb-0.5 block text-zinc-600">{t("quant.pairCode")}</span>
                  <input
                    value={pairCode}
                    onChange={(event) => setPairCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={t("quant.pairPlaceholder")}
                    inputMode="numeric"
                    className={FIELD_CLASS}
                  />
                </label>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs">
                <span className="mb-0.5 block text-zinc-600">{t("quant.startDate")}</span>
                <input
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-0.5 block text-zinc-600">{t("quant.endDate")}</span>
                <input
                  type="date"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="col-span-2 block text-xs">
                <span className="mb-0.5 block text-zinc-600">{t("quant.initCash")}</span>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={cash}
                  onChange={(event) => setCash(event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-0.5 block text-zinc-600">{t("quant.commissionPct")}</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={commissionPct}
                  onChange={(event) => setCommissionPct(event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-0.5 block text-zinc-600">{t("quant.commissionMin")}</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={commissionMin}
                  onChange={(event) => setCommissionMin(event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="col-span-2 block text-xs">
                <span className="mb-0.5 block text-zinc-600">{t("quant.stampTaxPct")}</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={stampTaxPct}
                  onChange={(event) => setStampTaxPct(event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
            </div>
            <p className="text-[11px] leading-snug text-zinc-500">{t("quant.commissionHint")}</p>
            <p className="text-[11px] leading-snug text-zinc-500">{t("quant.stampTaxHint")}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={!code || submitting || !cashValid || !feesValid || !pairReady}
                className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? t("quant.backtestRunning") : t("quant.runBacktest")}
              </button>
              {!code ? <span className="text-xs text-amber-700">{t("quant.pickCode")}</span> : null}
              {code && !pairReady ? <span className="text-xs text-amber-700">{t("quant.pickPair")}</span> : null}
              {error ? <span className="text-xs text-red-600">{error}</span> : null}
            </div>
          </div>
          <aside className="rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-900">
              {t("quant.guideTitle")} · {strategyLabel(strategyId)}
            </h3>
            <p className="mt-2 text-[11px] text-zinc-500">{t("quant.guideFill")}</p>
            {STRATEGY_GUIDES[strategyId] ? (
              <>
                <h4 className="mt-3 font-semibold text-zinc-800">{t("quant.guideLogic")}</h4>
                <p className="mt-1">{t(STRATEGY_GUIDES[strategyId].logic)}</p>
                <h4 className="mt-3 font-semibold text-zinc-800">{t("quant.guideParams")}</h4>
                <p className="mt-1">{t(STRATEGY_GUIDES[strategyId].params)}</p>
                <h4 className="mt-3 font-semibold text-zinc-800">{t("quant.guideExample")}</h4>
                <p className="mt-1">{t(STRATEGY_GUIDES[strategyId].example)}</p>
              </>
            ) : null}
          </aside>
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
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 11 }}
                      width={96}
                      tickFormatter={(value) => money(Number(value))}
                    />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Legend />
                    {drawdownRange ? (
                      <ReferenceArea
                        x1={drawdownRange.peak.date}
                        x2={drawdownRange.trough.date}
                        fill="#fecaca"
                        fillOpacity={0.45}
                        strokeOpacity={0}
                      />
                    ) : null}
                    {drawdownRange && run.cash > 0 ? (
                      <>
                        <ReferenceLine
                          x={drawdownRange.peak.date}
                          stroke="#dc2626"
                          strokeWidth={1.5}
                          label={{
                            value: percent(drawdownRange.peak.value / run.cash - 1),
                            fill: "#dc2626",
                            fontSize: 11,
                            position: "insideTopLeft",
                          }}
                        />
                        <ReferenceLine
                          x={drawdownRange.trough.date}
                          stroke="#dc2626"
                          strokeWidth={1.5}
                          label={{
                            value: percent(drawdownRange.trough.value / run.cash - 1),
                            fill: "#dc2626",
                            fontSize: 11,
                            position: "insideTopRight",
                          }}
                        />
                      </>
                    ) : null}
                    <Line
                      type="monotone"
                      dataKey="hold"
                      name={t("quant.equityHold")}
                      stroke="#18181b"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={t("quant.equityStrategy")}
                      stroke="#b45309"
                      strokeWidth={2}
                      dot={false}
                    />
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
              {metricItems.map((item) => (
                <div key={item.label} className="overflow-visible rounded-lg bg-zinc-100 px-4 py-3">
                  <dt className="flex items-center text-xs text-zinc-500">
                    {item.label}
                    <MetricHint text={item.hint} />
                  </dt>
                  <dd className={`mt-1 text-lg font-semibold ${item.valueClass ?? ""}`}>{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold">{t("quant.backtestTrades")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">{t("quant.date")}</th>
                    <th className="px-4 py-3">{t("quant.side")}</th>
                    <th className="px-4 py-3">{t("quant.fillPrice")}</th>
                    <th className="px-4 py-3">{t("quant.qtyCol")}</th>
                    <th className="px-4 py-3">{t("quant.marketValue")}</th>
                    <th className="px-4 py-3">{t("quant.cashAfterTrade")}</th>
                    <th className="px-4 py-3">{t("quant.backtestFees")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {pageSlice(run.trades ?? [], tradePage).map((trade, index) => (
                    <tr key={`${trade.date}-${trade.side}-${index}`}>
                      <td className="px-4 py-3">{trade.date}</td>
                      <td className="px-4 py-3">{trade.side === "buy" ? t("quant.buy") : t("quant.sell")}</td>
                      <td className="px-4 py-3">{money(trade.price)}</td>
                      <td className="px-4 py-3">{trade.quantity}</td>
                      <td className="px-4 py-3">
                        {trade.market_value == null ? t("common.dash") : money(trade.market_value)}
                      </td>
                      <td className="px-4 py-3">
                        {trade.cash == null ? t("common.dash") : money(trade.cash)}
                      </td>
                      <td className="px-4 py-3">{money(trade.commission + trade.stamp_tax)}</td>
                    </tr>
                  ))}
                  {!run.trades?.length ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">{t("quant.noTrades")}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="border-t border-zinc-200">
              <PageToolbar page={tradePage} totalItems={run.trades?.length ?? 0} onPageChange={setTradePage} />
            </div>
          </section>
        </>
      ) : loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500">
          {t("quant.historyLoading")}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold">{t("quant.recentBacktests")}</h3>
        {runs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">{t("quant.symbol")}</th>
                  <th className="px-4 py-3">{t("quant.strategy")}</th>
                  <th className="px-4 py-3">{t("quant.startDate")}</th>
                  <th className="px-4 py-3">{t("quant.endDate")}</th>
                  <th className="px-4 py-3 text-right">{t("quant.totalReturn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {runs.map((item) => (
                  <tr
                    key={item.id}
                    className={`cursor-pointer hover:bg-zinc-50 ${run?.id === item.id ? "bg-zinc-50" : ""}`}
                    onClick={() => void openRun(item.id)}
                  >
                    <td className="px-4 py-3">
                      {item.code}
                      {typeof item.params?.pair_code === "string" ? `/${item.params.pair_code}` : ""}
                    </td>
                    <td className="px-4 py-3">{strategyLabel(item.strategy_id)}</td>
                    <td className="px-4 py-3">{item.start}</td>
                    <td className="px-4 py-3">{item.end}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">
                      {item.metrics ? percent(item.metrics.total_return) : t("common.dash")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-zinc-500">{t("quant.noBacktests")}</p>
        )}
      </section>
    </div>
  );
}
