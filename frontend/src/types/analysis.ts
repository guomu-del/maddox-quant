export interface MetricItem {
  name: string;
  value: string;
  context?: string | null;
}

export interface FactorItem {
  name: string;
  direction: "positive" | "negative" | "neutral";
  description?: string | null;
}

export interface AnalysisResult {
  id: number;
  report_id: number;
  summary?: string | null;
  metrics?: MetricItem[] | null;
  factors?: FactorItem[] | null;
  sentiment?: "bullish" | "neutral" | "bearish" | null;
  investment_thesis?: string | null;
  risks?: string[] | null;
  created_at?: string | null;
}

export interface AnalysisJob {
  id: number;
  report_id: number;
  status: "pending" | "running" | "done" | "failed";
  error?: string | null;
  created_at?: string | null;
  finished_at?: string | null;
}

export interface AnalyzeStartResponse {
  job_id: number;
}
