"use client";
import { RotateCw } from "lucide-react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid place-items-center gap-3 px-6 py-24 text-center">
      <p className="text-[15px] font-semibold">Market data is unavailable right now</p>
      <p className="max-w-sm text-muted">{error.message.startsWith("Market data") ? "The data provider is rate-limiting or down. It usually recovers within a minute." : error.message}</p>
      <button onClick={reset} className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-fg px-3.5 font-semibold text-bg">
        <RotateCw className="size-4" /> Try again
      </button>
    </div>
  );
}
