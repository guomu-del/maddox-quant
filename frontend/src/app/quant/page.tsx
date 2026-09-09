import { Suspense } from "react";

import { QuantWorkbench } from "@/components/quant/QuantWorkbench";

export default function QuantRoute() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 text-zinc-500">加载中…</div>}>
      <QuantWorkbench />
    </Suspense>
  );
}
