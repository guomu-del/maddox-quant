"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchAnalysis,
  fetchAnalysisJob,
  startAnalysis,
} from "@/lib/reports-api";
import type { AnalysisResult } from "@/types/analysis";
import type { Report } from "@/types/report";

const SENTIMENT_LABEL = {
  bullish: { text: "利好", className: "bg-emerald-50 text-emerald-700" },
  neutral: { text: "中性", className: "bg-zinc-100 text-zinc-700" },
  bearish: { text: "利空", className: "bg-red-50 text-red-700" },
} as const;

const DIRECTION_LABEL = {
  positive: "↑ 正面",
  negative: "↓ 负面",
  neutral: "→ 中性",
} as const;

export function AnalysisPanel({ report }: { report: Report }) {
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
      setError(err instanceof Error ? err.message : "加载分析结果失败");
    } finally {
      setLoading(false);
    }
  }, [report.id]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  async function handleAnalyze() {
    if (report.status !== "parsed") {
      setError("请等待 PDF 解析完成后再进行分析");
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
          throw new Error(job.error ?? "分析失败");
        }
        attempts += 1;
      }
      await loadAnalysis();
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-zinc-500">加载分析结果...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          使用 DeepSeek 对研报进行结构化分析，提取指标、因子与投资观点。
        </p>
        <button
          onClick={() => void handleAnalyze()}
          disabled={running || report.status !== "parsed"}
          className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {running ? "分析中..." : analysis ? "重新分析" : "开始分析"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!analysis ? (
        <div className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-zinc-500">
          暂无 AI 分析结果，点击「开始分析」生成。
        </div>
      ) : (
        <>
          {analysis.sentiment && (
            <div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  SENTIMENT_LABEL[analysis.sentiment].className
                }`}
              >
                {SENTIMENT_LABEL[analysis.sentiment].text}
              </span>
            </div>
          )}

          {analysis.summary && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">摘要</h3>
              <p className="text-sm leading-7 text-zinc-700">{analysis.summary}</p>
            </section>
          )}

          {analysis.investment_thesis && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">核心观点</h3>
              <p className="text-sm leading-7 text-zinc-700">{analysis.investment_thesis}</p>
            </section>
          )}

          {analysis.metrics && analysis.metrics.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">关键指标</h3>
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-600">
                    <tr>
                      <th className="px-3 py-2">指标</th>
                      <th className="px-3 py-2">数值</th>
                      <th className="px-3 py-2">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.metrics.map((metric) => (
                      <tr key={`${metric.name}-${metric.value}`} className="border-t border-zinc-100">
                        <td className="px-3 py-2 font-medium">{metric.name}</td>
                        <td className="px-3 py-2">{metric.value}</td>
                        <td className="px-3 py-2 text-zinc-600">{metric.context || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {analysis.factors && analysis.factors.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">投资因子</h3>
              <ul className="space-y-2">
                {analysis.factors.map((factor) => (
                  <li
                    key={factor.name}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <span>{factor.name}</span>
                      <span className="text-zinc-500">
                        {DIRECTION_LABEL[factor.direction]}
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
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">风险点</h3>
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
