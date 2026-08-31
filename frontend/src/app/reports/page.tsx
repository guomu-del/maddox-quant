import { Suspense } from "react";

import { ReportListPanel } from "@/components/reports/ReportListPanel";

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">加载中...</div>}>
      <ReportListPanel />
    </Suspense>
  );
}
