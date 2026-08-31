export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-4">
          <div className="h-4 flex-1 rounded bg-zinc-200" />
          <div className="h-4 w-24 rounded bg-zinc-200" />
          <div className="h-4 w-16 rounded bg-zinc-200" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 h-6 w-1/3 rounded bg-zinc-200" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-zinc-200" />
        <div className="h-4 w-5/6 rounded bg-zinc-200" />
        <div className="h-4 w-2/3 rounded bg-zinc-200" />
      </div>
    </div>
  );
}
