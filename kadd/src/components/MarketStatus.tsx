"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { MarketSnapshot } from "@/lib/market";

export default function MarketStatus({ data }: { data: MarketSnapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
    <span className={data.error || data.stale ? "text-warn" : ""}>{pending ? "Refreshing…" : data.error ? "Market data unavailable" : data.stale ? "Stale · last available data" : "Market data loaded"}</span>
    {data.updatedAt !== null && <time title={new Date(data.updatedAt).toISOString()} dateTime={new Date(data.updatedAt).toISOString()}>Last updated: {new Date(data.updatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC</time>}
    {data.updatedAt === null && <span>Last updated: unavailable</span>}
    <button disabled={pending} onClick={() => startTransition(() => router.refresh())} className="inline-flex min-h-9 items-center gap-1.5 hover:text-fg disabled:opacity-50"><RefreshCw className={`size-3 ${pending ? "animate-spin" : ""}`} />{data.error || data.stale ? "Retry" : "Refresh"}</button>
  </div>;
}
