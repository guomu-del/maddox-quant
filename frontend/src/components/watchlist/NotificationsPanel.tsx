"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/watchlist-api";
import type { NotificationItem } from "@/types/watchlist";

export function NotificationsPanel() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleRead(id: number) {
    await markNotificationRead(id);
    await load();
  }

  async function handleReadAll() {
    await markAllNotificationsRead();
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">通知中心</h1>
          <p className="mt-1 text-sm text-zinc-600">关注范围内的重大事件与研报更新</p>
        </div>
        <button
          onClick={() => void handleReadAll()}
          className="h-9 rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-50"
        >
          全部已读
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-center text-zinc-500">加载中...</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-zinc-500">
          暂无通知
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {items.map((item) => (
            <li
              key={item.id}
              className={`px-4 py-3 text-sm ${item.is_read ? "bg-white" : "bg-amber-50/40"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.event?.title ?? "通知"}</p>
                  {item.event?.content && (
                    <p className="mt-1 text-zinc-600">{item.event.content}</p>
                  )}
                  <p className="mt-2 text-xs text-zinc-400">
                    {item.created_at ? new Date(item.created_at).toLocaleString("zh-CN") : ""}
                  </p>
                  {item.event?.report_id && (
                    <Link
                      href={`/reports/${item.event.report_id}`}
                      className="mt-2 inline-block text-xs text-zinc-900 underline"
                    >
                      查看研报
                    </Link>
                  )}
                </div>
                {!item.is_read && (
                  <button
                    onClick={() => void handleRead(item.id)}
                    className="shrink-0 text-xs text-zinc-600 hover:text-zinc-900"
                  >
                    标记已读
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
