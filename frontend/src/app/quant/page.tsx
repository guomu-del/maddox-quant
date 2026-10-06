import { Suspense } from "react";

import { QuantWorkbench } from "@/components/quant/QuantWorkbench";
import { LoadingFallback } from "@/components/ui/LoadingFallback";

export default function QuantRoute() {
  return (
    <Suspense fallback={<LoadingFallback className="mx-auto max-w-6xl px-4 py-8 text-zinc-500" />}>
      <QuantWorkbench />
    </Suspense>
  );
}
