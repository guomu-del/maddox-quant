"use client";

import { useLocale } from "@/i18n/locale";

export const LIST_PAGE_SIZE = 10;

export function pageCount(length: number, size = LIST_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(length, 0) / size));
}

export function pageSlice<T>(items: T[], page: number, size = LIST_PAGE_SIZE): T[] {
  const total = pageCount(items.length, size);
  const current = Math.min(Math.max(page, 1), total);
  const start = (current - 1) * size;
  return items.slice(start, start + size);
}

export function PageToolbar({
  page,
  totalItems,
  onPageChange,
  compact = false,
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  compact?: boolean;
}) {
  const { t } = useLocale();
  if (totalItems <= 0) return null;
  const totalPages = pageCount(totalItems);
  const current = Math.min(Math.max(page, 1), totalPages);
  const buttonClass = compact
    ? "rounded-md border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-40"
    : "rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40";
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${compact ? "py-1" : "px-3 py-2"}`}>
      <button
        type="button"
        disabled={current <= 1}
        onClick={() => onPageChange(current - 1)}
        className={buttonClass}
      >
        {t("common.prev")}
      </button>
      <span className={compact ? "text-xs text-zinc-600" : "text-sm text-zinc-600"}>
        {current} / {totalPages}
      </span>
      <button
        type="button"
        disabled={current >= totalPages}
        onClick={() => onPageChange(current + 1)}
        className={buttonClass}
      >
        {t("common.next")}
      </button>
    </div>
  );
}
