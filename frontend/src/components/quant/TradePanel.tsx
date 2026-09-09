"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";

import {
  cancelOrder,
  fetchOrders,
  fetchPaperAccount,
  fetchPositions,
  fetchTrades,
  resetPaperAccount,
  submitOrder,
} from "@/lib/paper-api";
import type { StockQuote } from "@/types/market";
import type { PaperAccount, PaperOrder, PaperPosition, PaperTrade } from "@/types/quant";

type Side = "buy" | "sell";
type OrderType = "market" | "limit";

const money = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number): string {
  return money.format(value);
}

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("zh-CN") : "—";
}

function sideLabel(side: string): string {
  return side === "buy" ? "买入" : "卖出";
}

const statusLabels: Record<string, string> = {
  pending: "待成交",
  filled: "已成交",
  cancelled: "已撤单",
  rejected: "已拒绝",
};

export function TradePanel({ code, quote }: { code: string; quote: StockQuote | null }) {
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [side, setSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const nextAccount = await fetchPaperAccount();
      const nextPositions = await fetchPositions();
      const nextOrders = await fetchOrders();
      const nextTrades = await fetchTrades();
      setAccount(nextAccount);
      setPositions(nextPositions);
      setOrders(nextOrders);
      setTrades(nextTrades);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "仿真账户加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadData();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadData();
    }, 30_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadData();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadData]);

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    const parsedPrice = orderType === "limit" ? Number(price) : null;
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      await submitOrder({
        code,
        side,
        order_type: orderType,
        price: parsedPrice,
        quantity: parsedQuantity,
      });
      setMessage("委托已提交");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "委托提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id: number) {
    setMessage(null);
    setError(null);
    try {
      await cancelOrder(id);
      setMessage("委托已撤销");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤单失败");
    }
  }

  async function reset() {
    if (!window.confirm("将清空委托、成交与持仓，现金恢复为100万")) return;
    setMessage(null);
    setError(null);
    try {
      await resetPaperAccount();
      setMessage("仿真账户已重置");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "账户重置失败");
    }
  }

  const validQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0;
  const validPrice = orderType === "market" || (Number(price) > 0 && price.trim() !== "");

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              仿真，非实盘
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {quote?.name ? `${quote.name} ` : ""}
              <span className="text-sm font-normal text-zinc-500">{code || "未选择股票"}</span>
            </h2>
            {quote?.last != null ? (
              <p className="mt-1 text-sm text-zinc-600">最新价 {formatMoney(quote.last)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void reset()}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
          >
            重置仿真账户
          </button>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["现金", account?.cash],
            ["冻结", account?.frozen],
            ["总权益", account?.equity],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg bg-zinc-100 px-4 py-3">
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="mt-1 text-lg font-semibold">
                {typeof value === "number" ? `¥${formatMoney(value)}` : "—"}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <form onSubmit={placeOrder} className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold">下单</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">方向</span>
            <select
              aria-label="方向"
              value={side}
              onChange={(event) => setSide(event.target.value as Side)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3"
            >
              <option value="buy">买入</option>
              <option value="sell">卖出</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">委托类型</span>
            <select
              aria-label="委托类型"
              value={orderType}
              onChange={(event) => {
                const nextType = event.target.value as OrderType;
                setOrderType(nextType);
                if (nextType === "limit" && !price && quote?.last != null) {
                  setPrice(String(quote.last));
                }
              }}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3"
            >
              <option value="market">市价</option>
              <option value="limit">限价</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">价格</span>
            <input
              aria-label="价格"
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              disabled={orderType !== "limit"}
              onChange={(event) => setPrice(event.target.value)}
              placeholder={orderType === "market" ? "市价单无需填写" : "输入限价"}
              className="h-10 w-full rounded-lg border border-zinc-300 px-3 disabled:bg-zinc-100 disabled:text-zinc-400"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">数量</span>
            <input
              aria-label="数量"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 px-3"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!code || !validQuantity || !validPrice || submitting}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "提交中…" : side === "buy" ? "买入下单" : "卖出下单"}
          </button>
          {!code ? <span className="text-sm text-amber-700">请先选择股票代码</span> : null}
          {message ? <span className="text-sm text-emerald-700">{message}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </form>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500">
          仿真数据加载中…
        </div>
      ) : (
        <>
          <DataTable title="委托">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">时间</th><th className="px-4 py-3">标的</th>
                  <th className="px-4 py-3">方向</th><th className="px-4 py-3">类型</th>
                  <th className="px-4 py-3">价格</th><th className="px-4 py-3">数量/成交</th>
                  <th className="px-4 py-3">状态</th><th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 text-zinc-500">{formatTime(order.created_at)}</td>
                    <td className="px-4 py-3">{order.name} {order.code}</td>
                    <td className="px-4 py-3">{sideLabel(order.side)}</td>
                    <td className="px-4 py-3">{order.order_type === "market" ? "市价" : "限价"}</td>
                    <td className="px-4 py-3">{order.price == null ? "—" : formatMoney(order.price)}</td>
                    <td className="px-4 py-3">{order.quantity} / {order.filled_qty}</td>
                    <td className="px-4 py-3" title={order.reject_reason ?? undefined}>
                      {statusLabels[order.status] ?? order.status}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === "pending" ? (
                        <button type="button" onClick={() => void cancel(order.id)} className="text-zinc-700 underline">
                          撤单
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 ? <EmptyRow colSpan={8} /> : null}
              </tbody>
            </table>
          </DataTable>

          <DataTable title="成交">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">时间</th><th className="px-4 py-3">标的</th>
                  <th className="px-4 py-3">方向</th><th className="px-4 py-3">成交价</th>
                  <th className="px-4 py-3">数量</th><th className="px-4 py-3">费用</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {trades.map((trade) => (
                  <tr key={trade.id}>
                    <td className="px-4 py-3 text-zinc-500">{formatTime(trade.traded_at)}</td>
                    <td className="px-4 py-3">{trade.name} {trade.code}</td>
                    <td className="px-4 py-3">{sideLabel(trade.side)}</td>
                    <td className="px-4 py-3">{formatMoney(trade.price)}</td>
                    <td className="px-4 py-3">{trade.quantity}</td>
                    <td className="px-4 py-3">{formatMoney(trade.commission + trade.stamp_tax)}</td>
                  </tr>
                ))}
                {trades.length === 0 ? <EmptyRow colSpan={6} /> : null}
              </tbody>
            </table>
          </DataTable>

          <DataTable title="持仓">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">标的</th><th className="px-4 py-3">数量</th>
                  <th className="px-4 py-3">成本金额</th><th className="px-4 py-3">成本价</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {positions.map((position) => (
                  <tr key={position.id}>
                    <td className="px-4 py-3">{position.name} {position.code}</td>
                    <td className="px-4 py-3">{position.quantity}</td>
                    <td className="px-4 py-3">{formatMoney(position.cost_amount)}</td>
                    <td className="px-4 py-3">
                      {position.quantity > 0 ? formatMoney(position.cost_amount / position.quantity) : "—"}
                    </td>
                  </tr>
                ))}
                {positions.length === 0 ? <EmptyRow colSpan={4} /> : null}
              </tbody>
            </table>
          </DataTable>
        </>
      )}
    </div>
  );
}

function DataTable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold">{title}</h3>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-zinc-500">暂无数据</td>
    </tr>
  );
}
