import type {
  NotificationItem,
  NotificationListResponse,
  WatchlistItem,
} from "@/types/watchlist";

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

export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const res = await fetch(`${getApiBase()}/api/watchlist`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<WatchlistItem[]>;
}

export async function addWatchlist(payload: {
  target_type: "industry" | "sector" | "stock";
  target_code: string;
  target_name?: string;
  note?: string;
}): Promise<WatchlistItem> {
  const res = await fetch(`${getApiBase()}/api/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 409) throw new Error("已在关注列表中");
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<WatchlistItem>;
}

export async function deleteWatchlist(id: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/watchlist/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchNotifications(page = 1): Promise<NotificationListResponse> {
  const res = await fetch(`${getApiBase()}/api/notifications?page=${page}&page_size=20`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<NotificationListResponse>;
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetch(`${getApiBase()}/api/notifications/unread-count`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { count: number };
  return data.count;
}

export async function markNotificationRead(id: number): Promise<NotificationItem> {
  const res = await fetch(`${getApiBase()}/api/notifications/${id}/read`, { method: "PATCH" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<NotificationItem>;
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/notifications/read-all`, { method: "PATCH" });
  if (!res.ok) throw new Error(await res.text());
}
