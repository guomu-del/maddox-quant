export interface WatchlistItem {
  id: number;
  target_type: "industry" | "sector" | "stock";
  target_code: string;
  target_name?: string | null;
  note?: string | null;
  created_at?: string | null;
}

export interface EventBrief {
  id: number;
  event_type: string;
  title: string;
  content?: string | null;
  related_type?: string | null;
  related_code?: string | null;
  report_id?: number | null;
  severity: string;
  occurred_at?: string | null;
}

export interface NotificationItem {
  id: number;
  event_id: number;
  is_read: boolean;
  created_at?: string | null;
  event?: EventBrief | null;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  page_size: number;
}
