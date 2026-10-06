"use client";

import { useCallback, useEffect, useState } from "react";

import { localizeError, useLocale } from "@/i18n/locale";
import {
  fetchAnalysis,
  fetchAnalysisJob,
  startAnalysis,
} from "@/lib/reports-api";
import type { AnalysisResult } from "@/types/analysis";
import type { Report } from "@/types/report";

const SENTIMENT_STYLE = {
  bullish: "bg-emerald-50 text-emerald-700",
  neutral: "bg-zinc-100 text-zinc-700",
  bearish: "bg-red-50 text-red-700",
} as const;

export function AnalysisPanel({ report }: { report: Report }) {
  const { locale, t } = useLocale();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAnalysis(report.id);
      setAnalysis(data);
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "analysis.loadResultFailed"));
    } finally {
      setLoading(false);
    }
  }, [report.id, locale]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  async function handleAnalyze() {
    if (report.status !== "parsed") {
      setError(t("analysis.waitParse"));
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const { job_id } = await startAnalysis(report.id);
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        const job = await fetchAnalysisJob(job_id);
        if (job.status === "done") break;
        if (job.status === "failed") {
          throw new Error(job.error ?? t("analysis.failed"));
        }
        attempts += 1;
      }
      await loadAnalysis();
    } catch (err) {
      setError(localizeError(locale, err instanceof Error ? err.message : null, "analysis.failed"));
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-zinc-500">{t("analysis.loadingResult")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {t("analysis.startHint")}
        </p>
        <button
          onClick={() => void handleAnalyze()}
          disabled={running || report.status !== "parsed"}
          className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {running ? t("analysis.running") : analysis ? t("analysis.rerun") : t("analysis.start")}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!analysis ? (
        <div className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-zinc-500">
          {t("analysis.empty")}
        </div>
      ) : (
        <>
          {analysis.sentiment && (
            <div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  SENTIMENT_STYLE[analysis.sentiment]
                }`}
              >
                {t(
                  analysis.sentiment === "bullish"
                    ? "analysis.bullish"
                    : analysis.sentiment === "bearish"
                      ? "analysis.bearish"
                      : "analysis.neutral",
                )}
              </span>
            </div>
          )}

          {analysis.summary && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">{t("analysis.summary")}</h3>
              <p className="text-sm leading-7 text-zinc-700">{analysis.summary}</p>
            </section>
          )}

          {analysis.investment_thesis && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">{t("analysis.views")}</h3>
              <p className="text-sm leading-7 text-zinc-700">{analysis.investment_thesis}</p>
            </section>
          )}

          {analysis.metrics && analysis.metrics.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">{t("analysis.metrics")}</h3>
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-600">
                    <tr>
                      <th className="px-3 py-2">{t("analysis.metric")}</th>
                      <th className="px-3 py-2">{t("analysis.value")}</th>
                      <th className="px-3 py-2">{t("analysis.note")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.metrics.map((metric) => (
                      <tr key={`${metric.name}-${metric.value}`} className="border-t border-zinc-100">
                        <td className="px-3 py-2 font-medium">{metric.name}</td>
                        <td className="px-3 py-2">{metric.value}</td>
                        <td className="px-3 py-2 text-zinc-600">{metric.context || t("common.dash")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {analysis.factors && analysis.factors.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">{t("analysis.factors")}</h3>
              <ul className="space-y-2">
                {analysis.factors.map((factor) => (
                  <li
                    key={factor.name}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <span>{factor.name}</span>
                      <span className="text-zinc-500">
                        {factor.direction === "positive"
                          ? t("analysis.positive")
                          : factor.direction === "negative"
                            ? t("analysis.negative")
                            : t("analysis.neutralArrow")}
                      </span>
                    </div>
                    {factor.description && (
                      <p className="mt-1 text-zinc-600">{factor.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {analysis.risks && analysis.risks.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">{t("analysis.risks")}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
                {analysis.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
