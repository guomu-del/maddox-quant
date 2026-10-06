"use client";

import { useEffect } from "react";

import { useLocale } from "@/i18n/locale";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <h2 className="text-xl font-semibold text-zinc-900">{t("error.pageTitle")}</h2>
      <p className="mt-2 text-sm text-zinc-600">{error.message || t("error.unknown")}</p>
      <button
        onClick={reset}
        className="mt-6 h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
