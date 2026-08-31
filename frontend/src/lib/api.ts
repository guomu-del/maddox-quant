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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<T>;
}

export interface HealthResponse {
  status: string;
  db: string;
}
