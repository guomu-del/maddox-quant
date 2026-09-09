import { parseApiError } from "@/lib/api-error";
import type { BacktestRun, BacktestStrategy } from "@/types/quant";

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

export function fetchBacktestStrategies(): Promise<BacktestStrategy[]> {
  return json("/api/quant/strategies");
}

export function fetchBacktests(limit = 20): Promise<BacktestRun[]> {
  return json(`/api/quant/backtests?limit=${limit}`);
}

export function fetchBacktest(id: number): Promise<BacktestRun> {
  return json(`/api/quant/backtests/${id}`);
}

export function submitBacktest(body: {
  code: string;
  strategy_id: string;
  params: Record<string, number>;
  start: string;
  end: string;
  cash: number;
}): Promise<BacktestRun> {
  return json("/api/quant/backtests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
