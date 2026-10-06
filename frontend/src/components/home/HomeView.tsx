"use client";

import Link from "next/link";

import { useLocale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";
import type { HealthResponse } from "@/lib/api";

const modules: { titleKey: MessageKey; descKey: MessageKey; href: string }[] = [
  { titleKey: "home.marketTitle", descKey: "home.marketDesc", href: "/market" },
  { titleKey: "home.quantTitle", descKey: "home.quantDesc", href: "/quant" },
  { titleKey: "home.reportsTitle", descKey: "home.reportsDesc", href: "/reports" },
  { titleKey: "home.analysisTitle", descKey: "home.analysisDesc", href: "/analysis" },
  { titleKey: "home.watchlistTitle", descKey: "home.watchlistDesc", href: "/watchlist" },
  { titleKey: "home.notificationsTitle", descKey: "home.notificationsDesc", href: "/notifications" },
];

export function HomeView({ health }: { health: HealthResponse | null }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Maddox Quant</h1>
        <p className="mt-2 max-w-2xl text-zinc-600">{t("home.tagline")}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              health?.status === "ok" ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          <span>
            API {health ? health.status : t("home.apiUnavailable")}
            {health ? ` · ${t("home.database")} ${health.db}` : ""}
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
            <h2 className="text-lg font-semibold">{t(item.titleKey)}</h2>
            <p className="mt-2 text-sm text-zinc-600">{t(item.descKey)}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
