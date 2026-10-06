"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { fetchStockAnalysis } from "@/lib/analysis-api";
import { localizeError, useLocale } from "@/i18n/locale";
import type { StockAnalysisData } from "@/types/aggregation";

const SENTIMENT_COLOR: Record<string, string> = {
  bullish: "#10b981",
  neutral: "#a1a1aa",
  bearish: "#ef4444",
};

export function StockAnalysisPanel({ code }: { code: string }) {
  const { locale, t } = useLocale();
  const [data, setData] = useState<StockAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchStockAnalysis(code)
      .then(setData)
      .catch((err) => setError(localizeError(locale, err instanceof Error ? err.message : null, "common.loadFailed")))
      .finally(() => setLoading(false));
  }, [code, locale]);

  if (loading) return <div className="p-8 text-center text-zinc-500">{t("common.loading")}</div>;
  if (error || !data) return <div className="p-8 text-center text-red-600">{error ?? t("analysis.noDataShort")}</div>;

  const sentimentData = Object.entries(data.sentiment_distribution).map(([key, value]) => ({
    name: key === "bullish" ? t("analysis.bullish") : key === "bearish" ? t("analysis.bearish") : t("analysis.neutral"),
    key,
    value,
  }));

  return (
    <div className="space-y-6 py-8">
      <Link href="/analysis" className="text-sm text-zinc-600 hover:text-zinc-900">
        {t("common.backBoard")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{t("analysis.stockTitle", { stock: data.stock })}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {t("analysis.stockStats", { total: data.total_reports, analyzed: data.analyzed_count })}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">{t("analysis.sentimentDist")}</h2>
          {sentimentData.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">{t("analysis.noAnalysisData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {sentimentData.map((entry) => (
                    <Cell key={entry.key} fill={SENTIMENT_COLOR[entry.key] ?? "#71717a"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">{t("analysis.targetPrice")}</h2>
          {data.target_prices.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">{t("analysis.noTargetPrice")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.target_prices.map((price) => (
                <li key={price} className="rounded-lg bg-zinc-50 px-3 py-2">
                  {price}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">{t("analysis.linkedReports")}</h2>
        <ul className="divide-y divide-zinc-100">
          {data.reports.map((report) => (
            <li key={report.id} className="flex justify-between py-3 text-sm">
              <Link href={`/reports/${report.id}`} className="font-medium hover:underline">
                {report.title}
              </Link>
              <span className="text-zinc-500">{report.publish_date ?? t("common.dash")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
