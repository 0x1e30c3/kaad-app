"use client";
import Link from "next/link";
import { pnlUsd } from "@/lib/mock";
import { useAsync } from "@/lib/useAsync";
import type { TickerItem } from "@/app/api/ticker/route";
import WalletAvatar from "./WalletAvatar";

/**
 * A thin, endlessly scrolling strip of the top wallets under the top bar. Pauses on hover; static with reduced motion.
 * Loaded in the browser so statically built pages still show current numbers.
 */
export default function TickerStrip() {
  const { data: top, loading } = useAsync<TickerItem[]>(() => fetch("/api/ticker").then((r) => (r.ok ? r.json() : [])), []);
  if (!loading && !top?.length) return null;
  // Repeat a short list so one copy is always wider than the screen and the loop never shows a gap.
  const items = top?.length ? Array.from({ length: Math.ceil(16 / top.length) }, () => top).flat() : [];
  const row = (hidden: boolean) =>
    items.map((w, i) => (
      <Link key={`${w.address}-${i}`} href={`/wallet/${w.address}`} title={w.note} tabIndex={hidden || i >= top!.length ? -1 : undefined} className="flex items-center gap-1.5 px-3 h-full whitespace-nowrap hover:bg-hover">
        <WalletAvatar address={w.address} size={16} />
        <span className="max-w-36 truncate text-fg">{w.name}</span>
        <span className="text-up font-medium tabular-nums">{pnlUsd(w.pnl)}</span>
      </Link>
    ));
  return (
    <div className="hidden md:flex h-9 shrink-0 items-stretch border-b border-line bg-panel text-[12px]">
      <span className="shrink-0 flex items-center px-3 border-r border-line text-[11px] font-medium text-muted">Top wallets</span>
      <div className="relative flex-1 min-w-0 overflow-hidden motion-reduce:overflow-x-auto">
        <div className="marquee flex w-max h-full">
          <div className="flex">{row(false)}</div>
          <div aria-hidden className="flex motion-reduce:hidden">{row(true)}</div>
        </div>
      </div>
    </div>
  );
}
