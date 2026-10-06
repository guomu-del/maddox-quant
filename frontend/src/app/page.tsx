import { HomeView } from "@/components/home/HomeView";
import { apiFetch, type HealthResponse } from "@/lib/api";

async function getHealth(): Promise<HealthResponse | null> {
  try {
    return await apiFetch<HealthResponse>("/health");
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await getHealth();
  return <HomeView health={health} />;
}
