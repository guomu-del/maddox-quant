import { Suspense } from "react";

import { QuantWorkbench } from "@/components/quant/QuantWorkbench";
import { LoadingFallback } from "@/components/ui/LoadingFallback";

export default function QuantRoute() {
  return (
    <Suspense fallback={<LoadingFallback className="py-8 text-zinc-500" />}>
      <QuantWorkbench />
    </Suspense>
  );
}
