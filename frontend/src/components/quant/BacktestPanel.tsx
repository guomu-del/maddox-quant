"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { localizeError, useLocale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
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

  function number(value: number): string {
    return value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", { maximumFractionDigits: 2 });
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

  const metricItems = run?.metrics
    ? [
        [t("quant.totalReturn"), percent(run.metrics.total_return), t("quant.hintTotalReturn")],
        [t("quant.annualReturn"), percent(run.metrics.annual_return), t("quant.hintAnnualReturn")],
        [t("quant.maxDrawdown"), percent(run.metrics.max_drawdown), t("quant.hintMaxDrawdown")],
        [t("quant.winRate"), percent(run.metrics.win_rate), t("quant.hintWinRate")],
        [t("quant.profitFactor"), number(run.metrics.profit_factor), t("quant.hintProfitFactor")],
        [t("quant.tradeCount"), String(run.metrics.trade_count), t("quant.hintTradeCount")],
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
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => number(Number(value))} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={t("quant.equityStrategy")}
                      stroke="#18181b"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="hold"
                      name={t("quant.equityHold")}
                      stroke="#0284c7"
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
              {metricItems.map(([label, value, hint]) => (
                <div key={label} className="overflow-visible rounded-lg bg-zinc-100 px-4 py-3">
                  <dt className="flex items-center text-xs text-zinc-500">
                    {label}
                    <MetricHint text={hint} />
                  </dt>
                  <dd className="mt-1 text-lg font-semibold">{value}</dd>
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
                  {(run.trades ?? []).map((trade, index) => (
                    <tr key={`${trade.date}-${trade.side}-${index}`}>
                      <td className="px-4 py-3">{trade.date}</td>
                      <td className="px-4 py-3">{trade.side === "buy" ? t("quant.buy") : t("quant.sell")}</td>
                      <td className="px-4 py-3">{number(trade.price)}</td>
                      <td className="px-4 py-3">{trade.quantity}</td>
                      <td className="px-4 py-3">
                        {trade.market_value == null ? t("common.dash") : number(trade.market_value)}
                      </td>
                      <td className="px-4 py-3">
                        {trade.cash == null ? t("common.dash") : number(trade.cash)}
                      </td>
                      <td className="px-4 py-3">{number(trade.commission + trade.stamp_tax)}</td>
                    </tr>
                  ))}
                  {!run.trades?.length ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">{t("quant.noTrades")}</td></tr>
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
                    {item.code}
                    {typeof item.params?.pair_code === "string" ? `/${item.params.pair_code}` : ""}
                    {" · "}
                    {strategyLabel(item.strategy_id)} · {item.start} {t("quant.rangeTo")} {item.end}
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
