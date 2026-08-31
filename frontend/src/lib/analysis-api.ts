import type {
  IndustryAnalysisData,
  OverviewData,
  StockAnalysisData,
} from "@/types/aggregation";

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

export async function fetchOverview(): Promise<OverviewData> {
  const res = await fetch(`${getApiBase()}/api/analysis/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<OverviewData>;
}

export async function fetchIndustryAnalysis(code: string): Promise<IndustryAnalysisData> {
  const res = await fetch(`${getApiBase()}/api/analysis/industry/${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<IndustryAnalysisData>;
}

export async function fetchStockAnalysis(code: string): Promise<StockAnalysisData> {
  const res = await fetch(`${getApiBase()}/api/analysis/stock/${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<StockAnalysisData>;
}
