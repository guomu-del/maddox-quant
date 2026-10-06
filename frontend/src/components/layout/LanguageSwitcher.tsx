"use client";

import { useLocale } from "@/i18n/locale";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="flex items-center gap-1 text-sm font-medium" aria-label={t("lang.label")}>
      <button
        type="button"
        onClick={() => setLocale("zh")}
        aria-pressed={locale === "zh"}
        aria-label={t("lang.switchToZh")}
        className={
          locale === "zh"
            ? "text-zinc-900"
            : "text-zinc-400 transition-colors hover:text-zinc-700"
        }
      >
        {t("lang.zh")}
      </button>
      <span className="text-zinc-300" aria-hidden>
        /
      </span>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        aria-label={t("lang.switchToEn")}
        className={
          locale === "en"
            ? "text-zinc-900"
            : "text-zinc-400 transition-colors hover:text-zinc-700"
        }
      >
        {t("lang.en")}
      </button>
    </div>
  );
}
