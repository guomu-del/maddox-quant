import { ReportDetailPanel } from "@/components/reports/ReportDetailPanel";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportDetailPanel reportId={Number(id)} />;
}
