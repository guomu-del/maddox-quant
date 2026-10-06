"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useLocale } from "@/i18n/locale";
import { fetchUnreadCount } from "@/lib/watchlist-api";

export function NotificationBadge() {
  const { t } = useLocale();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const unread = await fetchUnreadCount();
        if (!cancelled) setCount(unread);
      } catch {
        if (!cancelled) setCount(0);
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <Link href="/notifications" className="relative transition-colors hover:text-zinc-900">
      {t("nav.notifications")}
      {count > 0 && (
        <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
