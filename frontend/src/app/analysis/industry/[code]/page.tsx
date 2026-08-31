import { IndustryAnalysisPanel } from "@/components/analysis/IndustryAnalysisPanel";

export default async function IndustryAnalysisPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <IndustryAnalysisPanel code={decodeURIComponent(code)} />;
}
