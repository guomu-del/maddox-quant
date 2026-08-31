import { StockAnalysisPanel } from "@/components/analysis/StockAnalysisPanel";

export default async function StockAnalysisPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <StockAnalysisPanel code={decodeURIComponent(code)} />;
}
