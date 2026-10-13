"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Flame, Zap } from "lucide-react";
import { usd } from "@/lib/mock";
import { ageOf, FRAME_LABEL, type Frame, type MarketSnapshot, type MarketToken } from "@/lib/market";
import { usePracticeOneClick, setPracticeOneClick } from "@/lib/quickBuyPreference";
import { RiskBadge, TokenIcon } from "../ui";
import QuickBuy from "../QuickBuy";
import Pane, { Tabs } from "./Pane";

type List = "hot" | "new" | "top";
const LISTS = [["hot", "Hot"], ["new", "New"], ["top", "Top vol"]] as const;
const FRAMES = [["m5", "5m"], ["h1", "1h"], ["h6", "6h"], ["h24", "24h"]] as const;

function Row({ t, frame, hot, amount }: { t: MarketToken; frame: Frame; hot: boolean; amount: number }) {
  const ch = t.change[frame];
  const up = ch >= 0;
  const flat = Math.abs(ch) < 0.05;
  return (
    <div className={`swap-row group relative flex items-center gap-3 px-3 py-2.5 border-b border-line bg-gradient-to-r to-transparent to-70% hover:bg-hover ${flat ? "from-transparent" : up ? "from-up/[0.07]" : "from-down/[0.07]"}`}>
      <Link href={`/token/${t.address}`} className="absolute inset-0" aria-label={`Open ${t.symbol}`} />
      <TokenIcon t={t} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{t.symbol}</span>
          {hot && <span className="shrink-0 h-4 px-1 rounded bg-down/15 text-down text-[10px] font-bold leading-4">HOT</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted tabular-nums">
          <span>{usd(t.price)}</span>
          <span suppressHydrationWarning>{ageOf(t.createdAt)}</span>
          <RiskBadge risk={t.risk} compact />
        </div>
      </div>
      <div className="swap-out text-right tabular-nums">
        <div className="text-[14px] font-semibold">{usd(t.mc)}</div>
        <div className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${flat ? "text-faint" : up ? "text-up" : "text-down"}`}>
          {flat ? null : up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          {Math.abs(ch).toLocaleString("en-US", { maximumFractionDigits: 1 })}%
        </div>
      </div>
      {/* Quick buy: always there on touch screens; on desktop it takes the price column's place on hover/focus. */}
      <div className="swap-in relative z-10">
        <QuickBuy t={t} usd={amount} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-brand-fill text-[#0a0a0a] text-[11px] font-semibold hover:brightness-95" />
      </div>
    </div>
  );
}

/** Trending Monad memecoins: hot (1h trades), newest pairs, or 24h volume, with % change over the chosen window. */
export default function TrendingPane({ lists }: { lists: Record<List, MarketSnapshot> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState<List>("hot");
  const [frame, setFrame] = useState<Frame>("h1");
  const [amount, setAmount] = useState("10");
  const oneClick = usePracticeOneClick();
  const snap = lists[list];
  // HOT = the three busiest tokens in the list by volume over the chosen window.
  const hot = new Set([...snap.tokens].sort((a, b) => b.vol[frame] - a.vol[frame]).slice(0, 3).map((t) => t.address));

  return (
    <Pane
      icon={<Flame />}
      title="Trending"
      meta={`% over ${FRAME_LABEL[frame]}`}
      controls={
        <>
          <Tabs label="List" value={list} options={LISTS} onChange={setList} />
          <div className="ml-auto"><Tabs label="Window" value={frame} options={FRAMES} onChange={setFrame} /></div>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <label className="flex items-center gap-1 h-7 pl-2 pr-1 rounded-md bg-raised focus-within:ring-1 focus-within:ring-line-strong" title="Quick buy amount (tUSDC, Monad testnet)">
            <Zap className="size-3" />
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="Quick buy amount in tUSDC" className="w-9 bg-transparent outline-none text-fg font-medium tabular-nums" />
            <span className="pr-1 text-faint">tUSDC</span>
          </label>
          <label className="flex items-center gap-1.5" title="Skip the review step for low-risk tokens">
            <input type="checkbox" checked={oneClick} onChange={(e) => setPracticeOneClick(e.target.checked)} /> One-click
          </label>
          <span role="status" className="ml-auto flex items-center gap-2">
            {pending ? "Refreshing…" : snap.error ? "Data unavailable" : snap.stale ? "Stale data" : snap.updatedAt !== null ? <time suppressHydrationWarning dateTime={new Date(snap.updatedAt).toISOString()}>{new Date(snap.updatedAt).toISOString().slice(11, 19)} UTC</time> : null}
            <button disabled={pending} onClick={() => startTransition(() => router.refresh())} className="underline disabled:opacity-50">{snap.error || snap.stale ? "Retry" : "Refresh"}</button>
          </span>
        </div>
      }
    >
      {snap.tokens.map((t) => <Row key={t.address} t={t} frame={frame} hot={list !== "new" && hot.has(t.address)} amount={parseFloat(amount) || 0} />)}
      {!snap.error && snap.tokens.length === 0 && <p className="p-6 text-center text-muted">Nothing here right now.</p>}
      {snap.error && <p className="p-6 text-center text-muted">Market data is unavailable right now. Retry in a moment.</p>}
    </Pane>
  );
}
