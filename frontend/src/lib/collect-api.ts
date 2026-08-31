import { apiFetch } from "@/lib/api";
import type {
  CollectLog,
  CollectRunResult,
  CollectSource,
  CollectSourceInput,
} from "@/types/collect-source";

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

export function fetchCollectSources(): Promise<CollectSource[]> {
  return apiFetch<CollectSource[]>("/api/admin/sources");
}

export function createCollectSource(payload: CollectSourceInput): Promise<CollectSource> {
  return apiFetch<CollectSource>("/api/admin/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateCollectSource(
  id: number,
  payload: Partial<CollectSourceInput>,
): Promise<CollectSource> {
  return apiFetch<CollectSource>(`/api/admin/sources/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteCollectSource(id: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/admin/sources/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export function runCollectSource(id: number): Promise<CollectRunResult> {
  return apiFetch<CollectRunResult>(`/api/admin/sources/${id}/run?sync=true`, {
    method: "POST",
  });
}

export function fetchCollectLogs(sourceId: number): Promise<CollectLog[]> {
  return apiFetch<CollectLog[]>(`/api/admin/sources/${sourceId}/logs`);
}
