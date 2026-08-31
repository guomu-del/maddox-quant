import type { Report, ReportListResponse } from "@/types/report";

function getApiBase(): string {
  if (typeof window === "undefined") {
    return (
      process.env.INTERNAL_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:8765"
    );
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8765";
}

export async function fetchReports(params: {
  page?: number;
  page_size?: number;
  q?: string;
  industry?: string;
  source?: string;
}): Promise<ReportListResponse> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.q) search.set("q", params.q);
  if (params.industry) search.set("industry", params.industry);
  if (params.source) search.set("source", params.source);

  const res = await fetch(`${getApiBase()}/api/reports?${search.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ReportListResponse>;
}

export async function fetchReport(id: number): Promise<Report> {
  const res = await fetch(`${getApiBase()}/api/reports/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Report>;
}

export function getReportFileUrl(id: number): string {
  return `${getApiBase()}/api/reports/${id}/file`;
}

export async function importReport(formData: FormData): Promise<Report> {
  const res = await fetch(`${getApiBase()}/api/reports/import`, {
    method: "POST",
    body: formData,
  });

  if (res.status === 409) {
    const body = await res.json();
    const existingId = body.detail?.existing_report_id;
    throw new Error(
      existingId
        ? `该 PDF 已导入（研报 ID: ${existingId}）`
        : "该 PDF 已存在",
    );
  }

  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Report>;
}
