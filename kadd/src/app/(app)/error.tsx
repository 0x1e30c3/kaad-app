"use client";
import { useEffect } from "react";
import { RotateCw } from "lucide-react";

/** Friendly fallback for any data page; the technical details go to the console, not the user. */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => console.error("[kadd] page error", error), [error]);
  return (
    <div className="grid place-items-center gap-3 px-6 py-24 text-center">
      <p className="text-[15px] font-semibold">This page couldn’t load its data</p>
      <p className="max-w-sm text-muted">Monad testnet or a market-data provider is busy or rate-limiting. It usually recovers within a minute.</p>
      <button onClick={reset} className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-fg px-3.5 font-semibold text-bg">
        <RotateCw className="size-4" /> Try again
      </button>
    </div>
  );
}
