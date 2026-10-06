"use client";

import { useLocale } from "@/i18n/locale";

export function LoadingFallback({ className }: { className?: string }) {
  const { t } = useLocale();
  return <div className={className}>{t("common.loading")}</div>;
}
