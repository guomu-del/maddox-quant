"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { fetchOverview } from "@/lib/analysis-api";
import type { OverviewData } from "@/types/aggregation";

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

export function OverviewDashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchOverview()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return <div className="py-12 text-center text-red-600">{error ?? "暂无数据"}</div>;
  }

  if (data.total_reports === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">分析看板</h1>
        <p className="mt-4 text-zinc-600">还没有研报数据，导入后将在此展示聚合分析。</p>
        <a href="/reports/import" className="mt-6 inline-block text-sm font-medium text-zinc-900 underline">
          导入第一篇研报
        </a>
      </div>
    );
  }

  const sentimentData = Object.entries(data.sentiment_distribution).map(([key, value]) => ({
    name: SENTIMENT_LABEL[key] ?? key,
    key,
    value,
  }));

  const analyzedRate =
    data.total_reports > 0
      ? Math.round((data.analyzed_count / data.total_reports) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">分析看板</h1>
        <p className="mt-1 text-sm text-zinc-600">跨研报聚合统计与趋势洞察</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="研报总数" value={String(data.total_reports)} />
        <StatCard title="已分析" value={`${data.analyzed_count} (${analyzedRate}%)`} />
        <StatCard
          title="利好研报"
          value={String(data.sentiment_distribution.bullish ?? 0)}
        />
        <StatCard
          title="热门行业"
          value={data.top_industries[0]?.name ?? "—"}
          subtitle={data.top_industries[0] ? `${data.top_industries[0].count} 篇` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="情感分布">
          {sentimentData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {sentimentData.map((entry) => (
                    <Cell key={entry.key} fill={SENTIMENT_COLOR[entry.key] ?? "#71717a"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="行业研报数量 Top 10">
          {data.top_industries.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.top_industries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="热门因子 Top 10">
          {data.top_factors.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.top_factors} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3f3f46" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="研报发布趋势（按周）">
          {data.report_trend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.report_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#18181b" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">最近入库研报</h2>
        {data.recent_reports.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无研报</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.recent_reports.map((report) => (
              <li key={report.id} className="flex items-center justify-between py-3 text-sm">
                <Link href={`/reports/${report.id}`} className="font-medium hover:underline">
                  {report.title}
                </Link>
                <span className="text-zinc-500">{report.publish_date ?? report.source ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.top_industries.length > 0 && (
        <section className="flex flex-wrap gap-2">
          {data.top_industries.map((item) => (
            <Link
              key={item.name}
              href={`/analysis/industry/${encodeURIComponent(item.name)}`}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm hover:bg-zinc-50"
            >
              {item.name} ({item.count})
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-600">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-zinc-900">{title}</h2>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-zinc-400">
      暂无数据
    </div>
  );
}
