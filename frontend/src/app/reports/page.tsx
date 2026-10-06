import { Suspense } from "react";

import { ReportListPanel } from "@/components/reports/ReportListPanel";
import { LoadingFallback } from "@/components/ui/LoadingFallback";

export default function ReportsPage() {
  return (
    <Suspense fallback={<LoadingFallback className="p-8 text-center text-zinc-500" />}>
      <ReportListPanel />
    </Suspense>
  );
}
