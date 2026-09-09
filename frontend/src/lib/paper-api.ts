import { parseApiError } from "@/lib/api-error";
import type { PaperAccount, PaperOrder, PaperPosition, PaperTrade } from "@/types/quant";

function getApiBase(): string {
  if (typeof window === "undefined") {
    return (
      process.env.INTERNAL_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:8765"
    );
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8765";
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    cache: "no-store",
    ...init,
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<T>;
}

export function fetchPaperAccount(): Promise<PaperAccount> {
  return json("/api/paper/account");
}

export function resetPaperAccount(): Promise<PaperAccount> {
  return json("/api/paper/account/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export function fetchPositions(): Promise<PaperPosition[]> {
  return json("/api/paper/positions");
}

export function fetchOrders(params?: {
  status?: string;
  code?: string;
}): Promise<PaperOrder[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.code) search.set("code", params.code);
  const query = search.size > 0 ? `?${search.toString()}` : "";
  return json(`/api/paper/orders${query}`);
}

export function fetchTrades(code?: string): Promise<PaperTrade[]> {
  const query = code ? `?${new URLSearchParams({ code }).toString()}` : "";
  return json(`/api/paper/trades${query}`);
}

export function submitOrder(body: {
  code: string;
  side: "buy" | "sell";
  order_type: "market" | "limit";
  price: number | null;
  quantity: number;
}): Promise<PaperOrder> {
  return json("/api/paper/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function cancelOrder(id: number): Promise<PaperOrder> {
  return json(`/api/paper/orders/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}
