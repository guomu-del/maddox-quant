"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { fetchReports } from "@/lib/reports-api";
import type { Report } from "@/types/report";

const STATUS_LABEL: Record<Report["status"], string> = {
  pending: "解析中",
  parsed: "已解析",
  failed: "解析失败",
};

export function ReportListPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [industry, setIndustry] = useState(searchParams.get("industry") ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, q, industry]);

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

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">研报库</h1>
          <p className="mt-1 text-sm text-zinc-600">共 {total} 篇研报</p>
        </div>
        <Link
          href="/reports/import"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          导入研报
        </Link>
      </div>

      <form
        onSubmit={applyFilters}
        className="mb-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_200px_auto]"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题、摘要、全文..."
          className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
        />
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="行业筛选"
          className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-zinc-100 px-4 text-sm font-medium hover:bg-zinc-200"
        >
          筛选
        </button>
      </form>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
          {error}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-zinc-600">暂无研报</p>
          <Link href="/reports/import" className="mt-4 inline-block text-sm text-zinc-900 underline">
            导入第一篇研报
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="px-4 py-3 font-medium">行业</th>
                <th className="px-4 py-3 font-medium">来源</th>
                <th className="px-4 py-3 font-medium">日期</th>
                <th className="px-4 py-3 font-medium">状态</th>
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
                    {report.industries?.join("、") || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{report.source || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{report.publish_date || "—"}</td>
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
                      {STATUS_LABEL[report.status]}
                    </span>
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
            上一页
          </button>
          <span className="text-sm text-zinc-600">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
