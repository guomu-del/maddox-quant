"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";

import { localizeError, useLocale } from "@/i18n/locale";
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

export function TradePanel({ code, quote }: { code: string; quote: StockQuote | null }) {
  const { locale, t } = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  function formatMoney(value: number): string {
    return money.format(value);
  }
  function formatTime(value: string | null): string {
    return value ? new Date(value).toLocaleString(locale === "en" ? "en-US" : "zh-CN") : t("common.dash");
  }
  function sideLabel(side: string): string {
    return side === "buy" ? t("quant.buy") : t("quant.sell");
  }
  const statusLabels: Record<string, string> = {
    pending: t("quant.pending"),
    filled: t("quant.filled"),
    cancelled: t("quant.cancelled"),
    rejected: t("quant.rejected"),
  };
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
      setError(localizeError(locale, err instanceof Error ? err.message : null, "quant.accountFailed"));
    } finally {
      setLoading(false);
    }
  }, [locale]);

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
      setMessage(t("quant.orderSubmitted"));
      await loadData();
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "quant.orderSubmitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id: number) {
    setMessage(null);
    setError(null);
    try {
      await cancelOrder(id);
      setMessage(t("quant.orderCancelled"));
      await loadData();
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "quant.cancelFailed"));
    }
  }

  async function reset() {
    if (!window.confirm(t("quant.resetConfirm"))) return;
    setMessage(null);
    setError(null);
    try {
      await resetPaperAccount();
      setMessage(t("quant.resetDone"));
      await loadData();
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "quant.resetFailed"));
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
              {t("quant.paperOnly")}
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {quote?.name ? `${quote.name} ` : ""}
              <span className="text-sm font-normal text-zinc-500">{code || t("quant.noStock")}</span>
            </h2>
            {quote?.last != null ? (
              <p className="mt-1 text-sm text-zinc-600">{t("quant.lastPrice", { price: formatMoney(quote.last) })}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void reset()}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
          >
            {t("quant.reset")}
          </button>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            [t("quant.cash"), account?.cash],
            [t("quant.frozen"), account?.frozen],
            [t("quant.equity"), account?.equity],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg bg-zinc-100 px-4 py-3">
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="mt-1 text-lg font-semibold">
                {typeof value === "number" ? `¥${formatMoney(value)}` : t("common.dash")}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <form onSubmit={placeOrder} className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold">{t("quant.order")}</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">{t("quant.side")}</span>
            <select
              aria-label={t("quant.side")}
              value={side}
              onChange={(event) => setSide(event.target.value as Side)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3"
            >
              <option value="buy">{t("quant.buy")}</option>
              <option value="sell">{t("quant.sell")}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">{t("quant.orderType")}</span>
            <select
              aria-label={t("quant.orderType")}
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
              <option value="market">{t("quant.market")}</option>
              <option value="limit">{t("quant.limit")}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">{t("quant.price")}</span>
            <input
              aria-label={t("quant.price")}
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              disabled={orderType !== "limit"}
              onChange={(event) => setPrice(event.target.value)}
              placeholder={orderType === "market" ? t("quant.marketPriceHint") : t("quant.limitPriceHint")}
              className="h-10 w-full rounded-lg border border-zinc-300 px-3 disabled:bg-zinc-100 disabled:text-zinc-400"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">{t("quant.qty")}</span>
            <input
              aria-label={t("quant.qty")}
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
            {submitting ? t("quant.submitting") : side === "buy" ? t("quant.submitBuy") : t("quant.submitSell")}
          </button>
          {!code ? <span className="text-sm text-amber-700">{t("quant.pickCode")}</span> : null}
          {message ? <span className="text-sm text-emerald-700">{message}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </form>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500">
          {t("quant.accountLoading")}
        </div>
      ) : (
        <>
          <DataTable title={t("quant.orders")}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">{t("quant.time")}</th><th className="px-4 py-3">{t("quant.symbol")}</th>
                  <th className="px-4 py-3">{t("quant.side")}</th><th className="px-4 py-3">{t("quant.type")}</th>
                  <th className="px-4 py-3">{t("quant.price")}</th><th className="px-4 py-3">{t("quant.qtyFilled")}</th>
                  <th className="px-4 py-3">{t("quant.status")}</th><th className="px-4 py-3">{t("quant.action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 text-zinc-500">{formatTime(order.created_at)}</td>
                    <td className="px-4 py-3">{order.name} {order.code}</td>
                    <td className="px-4 py-3">{sideLabel(order.side)}</td>
                    <td className="px-4 py-3">{order.order_type === "market" ? t("quant.market") : t("quant.limit")}</td>
                    <td className="px-4 py-3">{order.price == null ? t("common.dash") : formatMoney(order.price)}</td>
                    <td className="px-4 py-3">{order.quantity} / {order.filled_qty}</td>
                    <td className="px-4 py-3" title={order.reject_reason ?? undefined}>
                      {statusLabels[order.status] ?? order.status}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === "pending" ? (
                        <button type="button" onClick={() => void cancel(order.id)} className="text-zinc-700 underline">
                          {t("quant.cancel")}
                        </button>
                      ) : t("common.dash")}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 ? <EmptyRow colSpan={8} label={t("common.noData")} /> : null}
              </tbody>
            </table>
          </DataTable>

          <DataTable title={t("quant.trades")}>
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">{t("quant.time")}</th><th className="px-4 py-3">{t("quant.symbol")}</th>
                  <th className="px-4 py-3">{t("quant.side")}</th><th className="px-4 py-3">{t("quant.fillPrice")}</th>
                  <th className="px-4 py-3">{t("quant.qtyCol")}</th><th className="px-4 py-3">{t("quant.fees")}</th>
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
                {trades.length === 0 ? <EmptyRow colSpan={6} label={t("common.noData")} /> : null}
              </tbody>
            </table>
          </DataTable>

          <DataTable title={t("quant.positions")}>
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">{t("quant.symbol")}</th><th className="px-4 py-3">{t("quant.qtyCol")}</th>
                  <th className="px-4 py-3">{t("quant.costAmount")}</th><th className="px-4 py-3">{t("quant.costPrice")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {positions.map((position) => (
                  <tr key={position.id}>
                    <td className="px-4 py-3">{position.name} {position.code}</td>
                    <td className="px-4 py-3">{position.quantity}</td>
                    <td className="px-4 py-3">{formatMoney(position.cost_amount)}</td>
                    <td className="px-4 py-3">
                      {position.quantity > 0 ? formatMoney(position.cost_amount / position.quantity) : t("common.dash")}
                    </td>
                  </tr>
                ))}
                {positions.length === 0 ? <EmptyRow colSpan={4} label={t("common.noData")} /> : null}
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

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-zinc-500">{label}</td>
    </tr>
  );
}
