"use client";

import { ImportReportForm } from "@/components/reports/ImportReportForm";
import { useLocale } from "@/i18n/locale";

export default function ImportReportPage() {
  const { t } = useLocale();
  return (
    <div className="py-8">
      <div className="mx-auto mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold">{t("import.pageTitle")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("import.pageHint")}</p>
      </div>
      <ImportReportForm />
    </div>
  );
}
