"use client";

import { useState } from "react";

import { quickAddWatchlist } from "@/components/watchlist/WatchlistPanel";

export function QuickWatchButtons({
  industries = [],
  stocks = [],
}: {
  industries?: string[];
  stocks?: string[];
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function watch(type: "industry" | "stock", code: string) {
    try {
      await quickAddWatchlist({ target_type: type, target_code: code, target_name: code });
      setMessage(`已关注${code}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "关注失败");
    }
  }

  if (!industries.length && !stocks.length) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-500">快捷关注：</span>
      {industries.map((code) => (
        <button
          key={`industry-${code}`}
          onClick={() => void watch("industry", code)}
          className="rounded-full border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50"
        >
          + {code}
        </button>
      ))}
      {stocks.map((code) => (
        <button
          key={`stock-${code}`}
          onClick={() => void watch("stock", code)}
          className="rounded-full border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50"
        >
          + {code}
        </button>
      ))}
      {message && <span className="text-xs text-emerald-600">{message}</span>}
    </div>
  );
}
