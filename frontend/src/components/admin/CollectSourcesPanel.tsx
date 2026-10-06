"use client";

import { useCallback, useEffect, useState } from "react";

import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { localizeError, useLocale } from "@/i18n/locale";
import {
  createCollectSource,
  deleteCollectSource,
  fetchCollectLogs,
  fetchCollectSources,
  runCollectSource,
  updateCollectSource,
} from "@/lib/collect-api";
import type { CollectLog, CollectSource } from "@/types/collect-source";

export function CollectSourcesPanel() {
  const { locale, t } = useLocale();
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

  function statusLabel(status: string | null | undefined): string {
    if (status === "success") return t("collect.success");
    if (status === "failed") return t("collect.failed");
    if (status === "running") return t("collect.runStatus");
    if (status === "queued") return t("collect.queued");
    return status ?? t("common.dash");
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSources(await fetchCollectSources());
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setError(localizeError(locale, err instanceof Error ? err.message : null, "collect.createFailed"));
    }
  }

  async function handleToggle(source: CollectSource) {
    try {
      await updateCollectSource(source.id, { is_enabled: !source.is_enabled });
      await load();
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "collect.updateFailed"));
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteCollectSource(id);
      if (expandedId === id) setExpandedId(null);
      await load();
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "collect.deleteFailed"));
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
      setError(localizeError(locale, err instanceof Error ? err.message : null, "collect.collectFailed"));
    } finally {
      setRunningId(null);
    }
  }

  async function loadLogs(sourceId: number) {
    setLogsLoading(true);
    try {
      setLogs(await fetchCollectLogs(sourceId));
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "collect.logsFailed"));
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
    <div className="space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t("collect.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("collect.hint")}</p>
      </div>

      <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">{t("collect.addTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("collect.namePlaceholder")}
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
          placeholder={t("collect.cronPlaceholder")}
          className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {t("collect.add")}
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : sources.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-zinc-500">
          {t("collect.empty")}
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
                    Cron: {source.cron_expr} · {t("collect.lastRun")}:{" "}
                    {source.last_run_at
                      ? new Date(source.last_run_at).toLocaleString(locale === "en" ? "en-US" : "zh-CN")
                      : t("collect.never")}{" "}
                    · {t("collect.status")}: {statusLabel(source.last_status)}
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
                    {source.is_enabled ? t("collect.enabled") : t("collect.disabled")}
                  </button>
                  <button
                    onClick={() => void handleRun(source.id)}
                    disabled={runningId === source.id}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {runningId === source.id ? t("collect.running") : t("collect.runNow")}
                  </button>
                  <button
                    onClick={() => void toggleLogs(source.id)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    {t("collect.logs")}
                  </button>
                  <button
                    onClick={() => void handleDelete(source.id)}
                    className="text-xs text-zinc-500 hover:text-red-600"
                  >
                    {t("collect.delete")}
                  </button>
                </div>
              </div>

              {expandedId === source.id && (
                <div className="mt-3 rounded-lg bg-zinc-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-zinc-600">{t("collect.logTitle")}</p>
                  {logsLoading ? (
                    <p className="text-xs text-zinc-500">{t("common.loading")}</p>
                  ) : logs.length === 0 ? (
                    <p className="text-xs text-zinc-500">{t("collect.noLogs")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {logs.map((log) => (
                        <li key={log.id} className="text-xs text-zinc-600">
                          {new Date(log.started_at).toLocaleString(locale === "en" ? "en-US" : "zh-CN")} ·{" "}
                          {t("collect.logLine", {
                            status: statusLabel(log.status),
                            found: log.items_found,
                            imported: log.items_new,
                          })}
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
