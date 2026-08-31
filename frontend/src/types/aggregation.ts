export interface CountItem {
  name: string;
  count: number;
}

export interface TrendItem {
  week: string;
  count: number;
}

export interface OverviewData {
  total_reports: number;
  analyzed_count: number;
  sentiment_distribution: Record<string, number>;
  top_industries: CountItem[];
  top_factors: CountItem[];
  report_trend: TrendItem[];
  recent_reports: {
    id: number;
    title: string;
    source?: string | null;
    publish_date?: string | null;
    status: string;
  }[];
}

export interface IndustryAnalysisData {
  industry: string;
  total_reports: number;
  analyzed_count: number;
  sentiment_distribution: Record<string, number>;
  top_factors: CountItem[];
  related_stocks: CountItem[];
  reports: {
    id: number;
    title: string;
    source?: string | null;
    publish_date?: string | null;
    status: string;
  }[];
}

export interface StockAnalysisData {
  stock: string;
  total_reports: number;
  analyzed_count: number;
  sentiment_distribution: Record<string, number>;
  target_prices: string[];
  reports: {
    id: number;
    title: string;
    source?: string | null;
    publish_date?: string | null;
    status: string;
  }[];
}
