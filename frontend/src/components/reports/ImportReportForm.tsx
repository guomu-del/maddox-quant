"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { localizeError, useLocale } from "@/i18n/locale";
import { importReport } from "@/lib/reports-api";

const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function ImportReportForm() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError(t("error.choosePdf"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t("error.fileOverLimit", { mb: MAX_UPLOAD_MB }));
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("file", file);

    setSubmitting(true);
    setError(null);

    try {
      const report = await importReport(formData);
      router.push(`/reports/${report.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const networkFailure =
        err instanceof TypeError ||
        message === "Failed to fetch" ||
        message === "Load failed" ||
        message.includes("NetworkError");
      if (networkFailure) {
        setError(t("error.network", { mb: MAX_UPLOAD_MB }));
      } else if (err instanceof Error) {
        setError(localizeError(locale, err.message, "error.importFailed"));
      } else {
        setError(t("error.importFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium">{t("import.title")}</label>
        <input
          name="title"
          required
          className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("import.source")}</label>
          <input name="source" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("import.author")}</label>
          <input name="author" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("import.publishDate")}</label>
        <input name="publish_date" type="date" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("import.industries")}</label>
          <input
            name="industries"
            placeholder={t("import.industriesPlaceholder")}
            className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("import.stocks")}</label>
          <input name="stocks" placeholder="300750,600519" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("import.pdf")}</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-600"
        />
        <p className="mt-1 text-xs text-zinc-500">{t("import.pdfHint", { mb: MAX_UPLOAD_MB })}</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? t("import.uploading") : t("import.submit")}
      </button>
    </form>
  );
}
