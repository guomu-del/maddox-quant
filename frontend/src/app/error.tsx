"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <h2 className="text-xl font-semibold text-zinc-900">页面加载出错</h2>
      <p className="mt-2 text-sm text-zinc-600">{error.message || "发生了未知错误"}</p>
      <button
        onClick={reset}
        className="mt-6 h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
      >
        重试
      </button>
    </div>
  );
}
