import Link from "next/link";
import { apiFetch, type HealthResponse } from "@/lib/api";

async function getHealth(): Promise<HealthResponse | null> {
  try {
    return await apiFetch<HealthResponse>("/health");
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await getHealth();

  const modules = [
    {
      title: "研报库",
      description: "导入、搜索与浏览行业研报",
      href: "/reports",
    },
    {
      title: "分析看板",
      description: "聚合分析指标、因子与情感分布",
      href: "/analysis",
    },
    {
      title: "我的关注",
      description: "关注行业、板块与个股",
      href: "/watchlist",
    },
    {
      title: "通知中心",
      description: "重大事件与研报更新提醒",
      href: "/notifications",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Maddox Quant</h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          面向投研场景的量化分析平台：研报采集与分析、关键因子提炼、关注与通知。
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              health?.status === "ok" ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          <span>
            API {health ? health.status : "不可用"}
            {health ? ` · 数据库 ${health.db}` : ""}
          </span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {modules.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md"
          >
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
