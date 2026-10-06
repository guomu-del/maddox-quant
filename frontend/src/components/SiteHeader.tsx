"use client";

import Link from "next/link";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { NotificationBadge } from "@/components/layout/NotificationBadge";
import { useLocale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/messages";

const navItems: { href: string; labelKey: MessageKey }[] = [
  { href: "/market", labelKey: "nav.market" },
  { href: "/quant", labelKey: "nav.quant" },
  { href: "/reports", labelKey: "nav.reports" },
  { href: "/analysis", labelKey: "nav.analysis" },
  { href: "/watchlist", labelKey: "nav.watchlist" },
  { href: "/admin/sources", labelKey: "nav.sources" },
];

export function SiteHeader() {
  const { t } = useLocale();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold text-zinc-900">
          Maddox Quant
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-zinc-600">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-zinc-900"
            >
              {t(item.labelKey)}
            </Link>
          ))}
          <NotificationBadge />
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
