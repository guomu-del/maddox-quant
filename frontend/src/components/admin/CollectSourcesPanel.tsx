"use client";

import { useEffect, useState } from "react";

import {
  createCollectSource,
  deleteCollectSource,
  fetchCollectLogs,
  fetchCollectSources,
  runCollectSource,
  updateCollectSource,
} from "@/lib/collect-api";
import type { CollectLog, CollectSource } from "@/types/collect-source";

const STATUS_LABEL: Record<string, string> = {
  success: "成功",
  failed: "失败",
  running: "运行中",
  queued: "排队中",
};

export function CollectSourcesPanel() {
  const [sources, setSources] = useState<CollectSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [cronExpr, setCronExpr] = useState("0 8 * * *");
  const [runningId, setRunningId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [logs, setLogs] = useState<CollectLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSources(await fetchCollectSources());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !url.trim()) return;
    try {
      await createCollectSource({
        name: name.trim(),
        url: url.trim(),
        cron_expr: cronExpr.trim() || "0 8 * * *",
        source_type: "rss",
        parser: "rss",
      });
      setName("");
      setUrl("");
      setCronExpr("0 8 * * *");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  }

  async function handleToggle(source: CollectSource) {
    try {
      await updateCollectSource(source.id, { is_enabled: !source.is_enabled });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteCollectSource(id);
      if (expandedId === id) setExpandedId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function handleRun(id: number) {
    setRunningId(id);
    setError(null);
    try {
      const result = await runCollectSource(id);
      await load();
      if (result.status === "success") {
        setExpandedId(id);
        await loadLogs(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "采集失败");
    } finally {
      setRunningId(null);
    }
  }

  async function loadLogs(sourceId: number) {
    setLogsLoading(true);
    try {
      setLogs(await fetchCollectLogs(sourceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "日志加载失败");
    } finally {
      setLogsLoading(false);
    }
  }

  async function toggleLogs(sourceId: number) {
    if (expandedId === sourceId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sourceId);
    await loadLogs(sourceId);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">采集源管理</h1>
        <p className="mt-1 text-sm text-zinc-600">
          配置 RSS 采集源，定时或手动抓取研报 PDF 并自动入库。
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">新增采集源</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名称（如 某券商 RSS）"
            className="h-10 rounded-lg border border-zinc-300 px-3 text-sm"
            required
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="RSS Feed URL"
            className="h-10 rounded-lg border border-zinc-300 px-3 text-sm"
            required
          />
        </div>
        <input
          value={cronExpr}
          onChange={(e) => setCronExpr(e.target.value)}
          placeholder="Cron 表达式（默认 0 8 * * * 每天 8 点）"
          className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          添加采集源
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-center text-zinc-500">加载中...</p>
      ) : sources.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-zinc-500">
          暂无采集源，请先添加 RSS 源
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {sources.map((source) => (
            <li key={source.id} className="px-4 py-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{source.name}</p>
                  <p className="mt-1 truncate text-zinc-500">{source.url}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Cron: {source.cron_expr} · 上次:{" "}
                    {source.last_run_at
                      ? new Date(source.last_run_at).toLocaleString("zh-CN")
                      : "未运行"}{" "}
                    · 状态: {STATUS_LABEL[source.last_status ?? ""] ?? source.last_status ?? "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void handleToggle(source)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      source.is_enabled
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {source.is_enabled ? "已启用" : "已停用"}
                  </button>
                  <button
                    onClick={() => void handleRun(source.id)}
                    disabled={runningId === source.id}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {runningId === source.id ? "采集中..." : "立即采集"}
                  </button>
                  <button
                    onClick={() => void toggleLogs(source.id)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    日志
                  </button>
                  <button
                    onClick={() => void handleDelete(source.id)}
                    className="text-xs text-zinc-500 hover:text-red-600"
                  >
                    删除
                  </button>
                </div>
              </div>

              {expandedId === source.id && (
                <div className="mt-3 rounded-lg bg-zinc-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-zinc-600">采集日志</p>
                  {logsLoading ? (
                    <p className="text-xs text-zinc-500">加载中...</p>
                  ) : logs.length === 0 ? (
                    <p className="text-xs text-zinc-500">暂无日志</p>
                  ) : (
                    <ul className="space-y-2">
                      {logs.map((log) => (
                        <li key={log.id} className="text-xs text-zinc-600">
                          {new Date(log.started_at).toLocaleString("zh-CN")} ·{" "}
                          {STATUS_LABEL[log.status] ?? log.status} · 发现 {log.items_found} · 新增{" "}
                          {log.items_new}
                          {log.error && (
                            <span className="ml-1 text-red-600">({log.error})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
