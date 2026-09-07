import { parseApiError } from "@/lib/api-error";
import type {
  BoardListResponse,
  MarketOverview,
  StockListResponse,
} from "@/types/market";

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

const SLOW_TIMEOUT_MS = 90_000;

async function marketFetch<T>(path: string, timeoutMs = SLOW_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("行情源响应较慢，请稍后重试");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMarketOverview(): Promise<MarketOverview> {
  return marketFetch<MarketOverview>("/api/market/overview");
}

export async function fetchMarketStocks(params: {
  q?: string;
  sort?: string;
  order?: string;
  page?: number;
  page_size?: number;
}): Promise<StockListResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.sort) search.set("sort", params.sort);
  if (params.order) search.set("order", params.order);
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  const query = search.toString();
  return marketFetch<StockListResponse>(`/api/market/stocks${query ? `?${query}` : ""}`);
}

export async function fetchMarketBoards(): Promise<BoardListResponse> {
  return marketFetch<BoardListResponse>("/api/market/boards?type=industry");
}
