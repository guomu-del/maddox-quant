export interface PaperAccount {
  id: number;
  cash: number;
  frozen: number;
  starting_cash: number;
  equity: number;
  updated_at: string | null;
}

export interface PaperOrder {
  id: number;
  account_id: number;
  code: string;
  name: string;
  side: "buy" | "sell";
  order_type: "market" | "limit";
  price: number | null;
  quantity: number;
  filled_qty: number;
  status: string;
  reject_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaperTrade {
  id: number;
  account_id: number;
  order_id: number;
  code: string;
  name: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  commission: number;
  stamp_tax: number;
  traded_at: string | null;
}

export interface PaperPosition {
  id: number;
  account_id: number;
  code: string;
  name: string;
  quantity: number;
  cost_amount: number;
}

export interface BacktestStrategy {
  id: "dual_ma" | "breakout";
  name: string;
  params: Record<string, number>;
}

export interface BacktestMetrics {
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  trade_count: number;
}

export interface BacktestEquityPoint {
  date: string;
  value: number;
}

export interface BacktestTrade {
  date: string;
  code: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  commission: number;
  stamp_tax: number;
}

export interface BacktestRun {
  id: number;
  code: string;
  strategy_id: string;
  params: Record<string, number>;
  start: string;
  end: string;
  cash: number;
  status: string;
  metrics: BacktestMetrics | null;
  equity: BacktestEquityPoint[] | null;
  trades: BacktestTrade[] | null;
  error: string | null;
  created_at: string | null;
}
