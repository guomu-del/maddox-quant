"use client";

import { dictionaries, type Locale } from "@/i18n/messages";

function currentLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  const stored = window.localStorage.getItem("maddox-quant-locale");
  return stored === "en" || stored === "zh" ? stored : "zh";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = currentLocale();
  const t = (key: keyof typeof dictionaries.zh) => dictionaries[locale][key];

  return (
    <html lang={locale === "en" ? "en" : "zh-CN"}>
      <body className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-zinc-900">{t("error.appTitle")}</h1>
          <p className="mt-2 text-sm text-zinc-600">{error.message || t("error.tryLater")}</p>
          <button
            onClick={reset}
            className="mt-6 h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t("common.reload")}
          </button>
        </div>
      </body>
    </html>
  );
}
