"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AnalysisPanel } from "@/components/reports/AnalysisPanel";
import { QuickWatchButtons } from "@/components/reports/QuickWatchButtons";
import { localizeError, useLocale } from "@/i18n/locale";
import { parseApiError } from "@/lib/api-error";
import { fetchReport, getReportFileUrl } from "@/lib/reports-api";
import type { Report, ReportTable } from "@/types/report";

function PdfPreview({ reportId }: { reportId: number }) {
  const { locale, t } = useLocale();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(getReportFileUrl(reportId));
        if (!response.ok) {
          throw new Error(await parseApiError(response));
        }
        const blob = await response.blob();
        const pdfBlob =
          blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(pdfBlob);
        if (!cancelled) setUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(localizeError(locale, err instanceof Error ? err.message : null, "error.pdfMissing"));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reportId]);

  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }
  if (!url) {
    return <div className="p-8 text-center text-zinc-500">{t("reports.pdfLoading")}</div>;
  }

  return (
    <iframe
      src={`${url}#toolbar=1&navpanes=0`}
      className="h-[70vh] w-full rounded-lg border border-zinc-200 bg-zinc-50"
      title="PDF preview"
    />
  );
}

function ExtractedTable({ rows }: { rows: string[][] }) {
  const { t } = useLocale();
  const [header, ...body] = rows;
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-zinc-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-700">
          <tr>
            {header.map((cell, index) => (
              <th key={index} className="whitespace-nowrap px-3 py-2 font-medium">
                {cell || t("common.dash")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-zinc-100">
              {header.map((_, colIndex) => (
                <td key={colIndex} className="whitespace-nowrap px-3 py-2 text-zinc-800">
                  {row[colIndex] || t("common.dash")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FullTextView({ report }: { report: Report }) {
  const { t } = useLocale();
  const tables = report.tables ?? [];
  const pages = (report.full_text || report.summary || "").split("\f");
  const hasText = pages.some((page) => page.trim());
  if (!hasText && tables.length === 0) {
    return <p className="text-sm text-zinc-500">{t("reports.noText")}</p>;
  }

  const tablesByPage = new Map<number, ReportTable[]>();
  for (const table of tables) {
    const list = tablesByPage.get(table.page) ?? [];
    list.push(table);
    tablesByPage.set(table.page, list);
  }

  const pageCount = Math.max(pages.length, ...tables.map((table) => table.page), 1);

  return (
    <div className="max-h-[70vh] space-y-8 overflow-auto text-sm leading-7 text-zinc-700">
      {Array.from({ length: pageCount }, (_, index) => {
        const page = index + 1;
        const text = pages[index] ?? "";
        const pageTables = tablesByPage.get(page) ?? [];
        if (!text.trim() && pageTables.length === 0) return null;
        return (
          <section key={page}>
            {pageCount > 1 ? (
              <h3 className="mb-2 text-xs font-medium tracking-wide text-zinc-400">{t("reports.page", { page })}</h3>
            ) : null}
            {text.trim() ? <div className="whitespace-pre-wrap">{text.trim()}</div> : null}
            {pageTables.map((table, tableIndex) => (
              <ExtractedTable key={`${page}-${tableIndex}`} rows={table.rows} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function ReportDetailPanel({ reportId }: { reportId: number }) {
  const { locale, t, joinList } = useLocale();
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
        if (!cancelled) setError(localizeError(locale, err instanceof Error ? err.message : null, "common.loadFailed"));
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
    return <div className="p-8 text-center text-zinc-500">{t("common.loading")}</div>;
  }

  if (error || !report) {
    return <div className="p-8 text-center text-red-600">{error ?? t("reports.missing")}</div>;
  }

  return (
    <div className="py-8">
      <Link href="/reports" className="text-sm text-zinc-600 hover:text-zinc-900">
        {t("common.back")}
      </Link>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-bold">{report.title}</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-600">
          {report.source && <span>{t("reports.sourceLabel")}{report.source}</span>}
          {report.author && <span>{t("reports.authorLabel")}{report.author}</span>}
          {report.publish_date && <span>{t("reports.dateLabel")}{report.publish_date}</span>}
          {report.industries?.length ? <span>{t("reports.industryLabel")}{joinList(report.industries)}</span> : null}
          {report.stocks?.length ? <span>{t("reports.stockLabel")}{joinList(report.stocks)}</span> : null}
        </div>
        <QuickWatchButtons industries={report.industries ?? []} stocks={report.stocks ?? []} />
      </div>

      <div className="mt-4 flex gap-2 border-b border-zinc-200">
        {(["preview", "text", "analysis"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === key ? "border-b-2 border-zinc-900 text-zinc-900" : "text-zinc-500"
            }`}
          >
            {key === "preview" ? t("reports.tabPreview") : key === "text" ? t("reports.tabText") : t("reports.tabAnalysis")}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
        {tab === "preview" && <PdfPreview reportId={report.id} />}
        {tab === "text" && <FullTextView report={report} />}
        {tab === "analysis" && <AnalysisPanel report={report} />}
      </div>
    </div>
  );
}
