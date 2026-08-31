"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-zinc-900">应用发生错误</h1>
          <p className="mt-2 text-sm text-zinc-600">{error.message || "请稍后重试"}</p>
          <button
            onClick={reset}
            className="mt-6 h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            重新加载
          </button>
        </div>
      </body>
    </html>
  );
}
