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

function number(value: number): string {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export function BacktestPanel({ code }: { code: string }) {
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
          setError(err instanceof Error ? err.message : "回测记录加载失败");
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
      setError(err instanceof Error ? err.message : "回测运行失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function openRun(id: number) {
    setError(null);
    try {
      setRun(await fetchBacktest(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "回测记录加载失败");
    }
  }

  const metricItems = run?.metrics
    ? [
        ["总收益", percent(run.metrics.total_return)],
        ["年化收益", percent(run.metrics.annual_return)],
        ["最大回撤", percent(run.metrics.max_drawdown)],
        ["胜率", percent(run.metrics.win_rate)],
        ["盈亏比", number(run.metrics.profit_factor)],
        ["成交次数", String(run.metrics.trade_count)],
      ]
    : [];

  return (
    <div className="space-y-4">
      <form onSubmit={runBacktest} className="rounded-xl border border-zinc-200 bg-white p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            回测不影响仿真账户
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            CTA 回测 <span className="text-sm font-normal text-zinc-500">{code || "未选择股票"}</span>
          </h2>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">策略</span>
            <select
              value={strategyId}
              onChange={(event) => changeStrategy(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3"
            >
              {(strategies.length
                ? strategies
                : [{ id: "dual_ma", name: "双均线", params: { fast: 5, slow: 20 } }]
              ).map((strategy) => (
                <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
              ))}
            </select>
          </label>
          {Object.entries(params).map(([key, value]) => (
            <label key={`${strategyId}-${key}`} className="text-sm">
              <span className="mb-1 block text-zinc-600">参数 {key}</span>
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
            <span className="mb-1 block text-zinc-600">开始日期</span>
            <input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 px-3"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">结束日期</span>
            <input
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 px-3"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">初始资金</span>
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
            {submitting ? "回测运行中…" : "运行回测"}
          </button>
          {!code ? <span className="text-sm text-amber-700">请先选择股票代码</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </form>

      {run ? (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold">净值曲线</h3>
            {run.equity?.length ? (
              <div className="mt-4 h-80">
                <ResponsiveContainer>
                  <LineChart data={run.equity}>
                    <CartesianGrid stroke="#f4f4f5" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={28} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => number(Number(value))} />
                    <Line type="monotone" dataKey="value" name="权益" stroke="#18181b" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-zinc-500">暂无净值数据</p>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold">回测指标</h3>
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
            <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold">回测成交</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">日期</th><th className="px-4 py-3">方向</th>
                    <th className="px-4 py-3">成交价</th><th className="px-4 py-3">数量</th>
                    <th className="px-4 py-3">费用</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(run.trades ?? []).map((trade, index) => (
                    <tr key={`${trade.date}-${trade.side}-${index}`}>
                      <td className="px-4 py-3">{trade.date}</td>
                      <td className="px-4 py-3">{trade.side === "buy" ? "买入" : "卖出"}</td>
                      <td className="px-4 py-3">{number(trade.price)}</td>
                      <td className="px-4 py-3">{trade.quantity}</td>
                      <td className="px-4 py-3">{number(trade.commission + trade.stamp_tax)}</td>
                    </tr>
                  ))}
                  {!run.trades?.length ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">暂无成交</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500">
          回测记录加载中…
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold">最近 20 次回测</h3>
        {runs.length ? (
          <ul className="mt-3 divide-y divide-zinc-100">
            {runs.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openRun(item.id)}
                  className="flex w-full items-center justify-between gap-4 py-3 text-left text-sm hover:text-zinc-600"
                >
                  <span>{item.code} · {item.strategy_id} · {item.start} 至 {item.end}</span>
                  <span className="shrink-0 text-zinc-500">
                    {item.metrics ? percent(item.metrics.total_return) : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">暂无回测记录</p>
        )}
      </section>
    </div>
  );
}
