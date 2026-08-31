import Link from "next/link";

const navItems = [
  { href: "/reports", label: "研报" },
  { href: "/analysis", label: "分析看板" },
  { href: "/watchlist", label: "我的关注" },
  { href: "/notifications", label: "通知中心" },
];

export function SiteHeader() {
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
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
