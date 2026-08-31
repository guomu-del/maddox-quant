"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { importReport } from "@/lib/reports-api";

const MAX_UPLOAD_MB = 50;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function ImportReportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("请选择 PDF 文件");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`文件超过 ${MAX_UPLOAD_MB}MB 限制，请压缩后重试`);
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
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("导入失败");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium">标题 *</label>
        <input
          name="title"
          required
          className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">来源</label>
          <input name="source" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">作者</label>
          <input name="author" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">发布日期</label>
        <input name="publish_date" type="date" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">行业（逗号分隔）</label>
          <input name="industries" placeholder="新能源,半导体" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">关联个股（逗号分隔）</label>
          <input name="stocks" placeholder="300750,600519" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">PDF 文件 *</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-600"
        />
        <p className="mt-1 text-xs text-zinc-500">支持 PDF，最大 {MAX_UPLOAD_MB}MB</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "上传中..." : "导入研报"}
      </button>
    </form>
  );
}
