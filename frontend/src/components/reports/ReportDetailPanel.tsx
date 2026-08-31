"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AnalysisPanel } from "@/components/reports/AnalysisPanel";
import { QuickWatchButtons } from "@/components/reports/QuickWatchButtons";
import { fetchReport, getReportFileUrl } from "@/lib/reports-api";
import type { Report } from "@/types/report";

export function ReportDetailPanel({ reportId }: { reportId: number }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"preview" | "text" | "analysis">("preview");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchReport(reportId);
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const timer = setInterval(() => {
      if (report?.status === "pending") void load();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [reportId, report?.status]);

  if (loading && !report) {
    return <div className="p-8 text-center text-zinc-500">加载中...</div>;
  }

  if (error || !report) {
    return <div className="p-8 text-center text-red-600">{error ?? "研报不存在"}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/reports" className="text-sm text-zinc-600 hover:text-zinc-900">
        ← 返回列表
      </Link>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-bold">{report.title}</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-600">
          {report.source && <span>来源：{report.source}</span>}
          {report.author && <span>作者：{report.author}</span>}
          {report.publish_date && <span>日期：{report.publish_date}</span>}
          {report.industries?.length ? <span>行业：{report.industries.join("、")}</span> : null}
          {report.stocks?.length ? <span>个股：{report.stocks.join("、")}</span> : null}
        </div>
        <QuickWatchButtons industries={report.industries ?? []} stocks={report.stocks ?? []} />
      </div>

      <div className="mt-4 flex gap-2 border-b border-zinc-200">
        {(["preview", "text", "analysis"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === key ? "border-b-2 border-zinc-900 text-zinc-900" : "text-zinc-500"
            }`}
          >
            {key === "preview" ? "PDF 预览" : key === "text" ? "全文" : "AI 分析"}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
        {tab === "preview" && (
          <iframe
            src={getReportFileUrl(report.id)}
            className="h-[70vh] w-full rounded-lg border border-zinc-200"
            title="PDF preview"
          />
        )}
        {tab === "text" && (
          <div className="max-h-[70vh] overflow-auto whitespace-pre-wrap text-sm leading-7 text-zinc-700">
            {report.full_text || report.summary || "暂无文本内容（可能仍在解析中）"}
          </div>
        )}
        {tab === "analysis" && <AnalysisPanel report={report} />}
      </div>
    </div>
  );
}
