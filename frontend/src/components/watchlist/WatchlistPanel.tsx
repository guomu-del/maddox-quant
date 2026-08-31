"use client";

import { useEffect, useState } from "react";

import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { addWatchlist, deleteWatchlist, fetchWatchlist } from "@/lib/watchlist-api";
import type { WatchlistItem } from "@/types/watchlist";

const TYPE_LABEL = {
  industry: "行业",
  sector: "板块",
  stock: "个股",
} as const;

export function WatchlistPanel() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<"industry" | "sector" | "stock">("industry");
  const [targetCode, setTargetCode] = useState("");
  const [targetName, setTargetName] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchWatchlist());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!targetCode.trim()) return;
    try {
      await addWatchlist({
        target_type: targetType,
        target_code: targetCode.trim(),
        target_name: targetName.trim() || targetCode.trim(),
        note: note.trim() || undefined,
      });
      setTargetCode("");
      setTargetName("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteWatchlist(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">我的关注</h1>
        <p className="mt-1 text-sm text-zinc-600">关注行业、板块或个股，有新研报入库时将收到通知。</p>
      </div>

      <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">添加关注</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as "industry" | "sector" | "stock")}
            className="h-10 rounded-lg border border-zinc-300 px-3 text-sm"
          >
            <option value="industry">行业</option>
            <option value="sector">板块</option>
            <option value="stock">个股</option>
          </select>
          <input
            value={targetCode}
            onChange={(e) => setTargetCode(e.target.value)}
            placeholder="代码/名称（如 新能源 或 300750）"
            className="h-10 rounded-lg border border-zinc-300 px-3 text-sm"
            required
          />
        </div>
        <input
          value={targetName}
          onChange={(e) => setTargetName(e.target.value)}
          placeholder="显示名称（可选）"
          className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（可选）"
          className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          添加关注
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-zinc-500">
          暂无关注项
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  <span className="mr-2 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {TYPE_LABEL[item.target_type]}
                  </span>
                  {item.target_name || item.target_code}
                </p>
                {item.note && <p className="mt-1 text-zinc-500">{item.note}</p>}
              </div>
              <button
                onClick={() => void handleDelete(item.id)}
                className="text-zinc-500 hover:text-red-600"
              >
                取消关注
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function quickAddWatchlist(payload: {
  target_type: "industry" | "sector" | "stock";
  target_code: string;
  target_name?: string;
}) {
  return addWatchlist(payload);
}
