export interface IndexQuote {
  code: string;
  name: string;
  last: number | null;
  change_pct: number | null;
  change_amt: number | null;
}

export interface MarketStats {
  up_count: number;
  down_count: number;
  flat_count: number;
  limit_up_count: number;
  limit_down_count: number;
  total_amount: number;
}

export interface MarketOverview {
  indices: IndexQuote[];
  stats: MarketStats;
  as_of: string;
  stale: boolean;
  is_trading: boolean;
}

export interface StockQuote {
  code: string;
  name: string;
  last: number | null;
  change_pct: number | null;
  change_amt: number | null;
  amount: number | null;
  turnover: number | null;
  pe: number | null;
}

export interface StockListResponse {
  items: StockQuote[];
  total: number;
  page: number;
  page_size: number;
  as_of: string;
  stale: boolean;
}

export interface BoardQuote {
  code: string;
  name: string;
  change_pct: number | null;
  lead_stock: string | null;
  lead_change_pct: number | null;
  up_count: number | null;
  down_count: number | null;
}

export interface BoardListResponse {
  items: BoardQuote[];
  as_of: string;
  stale: boolean;
}
