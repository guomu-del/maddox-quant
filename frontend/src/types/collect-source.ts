export interface CollectSource {
  id: number;
  name: string;
  source_type: string;
  url: string;
  cron_expr: string;
  parser: string;
  is_enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  created_at: string;
}

export interface CollectLog {
  id: number;
  source_id: number;
  status: string;
  items_found: number;
  items_new: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface CollectRunResult {
  log_id: number;
  status: string;
  items_found: number;
  items_new: number;
}

export interface CollectSourceInput {
  name: string;
  source_type?: string;
  url: string;
  cron_expr?: string;
  parser?: string;
  is_enabled?: boolean;
}
