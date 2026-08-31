"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fetchIndustryAnalysis } from "@/lib/analysis-api";
import type { IndustryAnalysisData } from "@/types/aggregation";

const SENTIMENT_LABEL: Record<string, string> = {
  bullish: "利好",
  neutral: "中性",
  bearish: "利空",
};

const SENTIMENT_COLOR: Record<string, string> = {
  bullish: "#10b981",
  neutral: "#a1a1aa",
  bearish: "#ef4444",
};

export function IndustryAnalysisPanel({ code }: { code: string }) {
  const [data, setData] = useState<IndustryAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchIndustryAnalysis(code)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <div className="p-8 text-center text-zinc-500">加载中...</div>;
  if (error || !data) return <div className="p-8 text-center text-red-600">{error ?? "无数据"}</div>;

  const sentimentData = Object.entries(data.sentiment_distribution).map(([key, value]) => ({
    name: SENTIMENT_LABEL[key] ?? key,
    key,
    value,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Link href="/analysis" className="text-sm text-zinc-600 hover:text-zinc-900">
        ← 返回看板
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{data.industry}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {data.total_reports} 篇研报 · {data.analyzed_count} 篇已分析
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">情感分布</h2>
          {sentimentData.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">暂无分析数据</p>
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
          <h2 className="mb-2 text-sm font-semibold">Top 因子</h2>
          {data.top_factors.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">暂无因子数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.top_factors} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3f3f46" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {data.related_stocks.length > 0 && (
        <section className="flex flex-wrap gap-2">
          <span className="text-sm text-zinc-600">关联个股：</span>
          {data.related_stocks.map((item) => (
            <Link
              key={item.name}
              href={`/analysis/stock/${encodeURIComponent(item.name)}`}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm hover:bg-zinc-50"
            >
              {item.name} ({item.count})
            </Link>
          ))}
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">相关研报</h2>
        <ul className="divide-y divide-zinc-100">
          {data.reports.map((report) => (
            <li key={report.id} className="flex justify-between py-3 text-sm">
              <Link href={`/reports/${report.id}`} className="font-medium hover:underline">
                {report.title}
              </Link>
              <span className="text-zinc-500">{report.publish_date ?? "—"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
