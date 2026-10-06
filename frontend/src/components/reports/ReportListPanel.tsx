"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { localizeError, useLocale } from "@/i18n/locale";
import { fetchReports, deleteReport } from "@/lib/reports-api";
import type { Report } from "@/types/report";

export function ReportListPanel() {
  const { locale, t, joinList } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [industry, setIndustry] = useState(searchParams.get("industry") ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const statusLabel: Record<Report["status"], string> = {
    pending: t("reports.statusPending"),
    parsed: t("reports.statusParsed"),
    failed: t("reports.statusFailed"),
  };

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReports({
        page,
        page_size: 20,
        q: q || undefined,
        industry: industry || undefined,
      });
      setReports(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, q, industry, locale]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (industry) params.set("industry", industry);
    router.push(`/reports?${params.toString()}`);
  }

  async function handleDelete(report: Report) {
    if (!window.confirm(t("reports.deleteConfirm"))) return;
    setDeletingId(report.id);
    setError(null);
    try {
      await deleteReport(report.id);
      await loadReports();
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "reports.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("reports.title")}</h1>
          <p className="mt-1 text-sm text-zinc-600">{t("reports.count", { total })}</p>
        </div>
        <Link
          href="/reports/import"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {t("reports.import")}
        </Link>
      </div>

      <form
        onSubmit={applyFilters}
        className="mb-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_200px_auto]"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("reports.searchPlaceholder")}
          className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
        />
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder={t("reports.industryPlaceholder")}
          className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-zinc-100 px-4 text-sm font-medium hover:bg-zinc-200"
        >
          {t("common.filter")}
        </button>
      </form>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : reports.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-zinc-600">{t("reports.empty")}</p>
          <Link href="/reports/import" className="mt-4 inline-block text-sm text-zinc-900 underline">
            {t("reports.importFirst")}
          </Link>
        </div>
      ) : reports.length === 0 ? null : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">{t("reports.colTitle")}</th>
                <th className="px-4 py-3 font-medium">{t("reports.colIndustry")}</th>
                <th className="px-4 py-3 font-medium">{t("reports.colSource")}</th>
                <th className="px-4 py-3 font-medium">{t("reports.colDate")}</th>
                <th className="px-4 py-3 font-medium">{t("reports.colStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("reports.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/reports/${report.id}`} className="font-medium text-zinc-900 hover:underline">
                      {report.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {report.industries?.length ? joinList(report.industries) : t("common.dash")}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{report.source || t("common.dash")}</td>
                  <td className="px-4 py-3 text-zinc-600">{report.publish_date || t("common.dash")}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        report.status === "parsed"
                          ? "bg-emerald-50 text-emerald-700"
                          : report.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {statusLabel[report.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/reports/${report.id}`}
                        className="text-sm font-medium text-zinc-900 hover:underline"
                      >
                        {t("reports.view")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDelete(report)}
                        disabled={deletingId === report.id}
                        className="text-sm text-zinc-500 hover:text-red-600 disabled:opacity-40"
                      >
                        {t("reports.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            {t("common.prev")}
          </button>
          <span className="text-sm text-zinc-600">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            {t("common.next")}
          </button>
        </div>
      )}
    </div>
  );
}
