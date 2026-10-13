"use client";
import { useSyncExternalStore } from "react";
import { ExternalLink, Star } from "lucide-react";
import { toggleFollow, useStore } from "@/lib/store";
import CopyButton from "../CopyButton";

const since = (ms: number, now: number) => {
  const s = Math.max(0, (now - ms) / 1000);
  return s < 60 ? `${Math.round(s)}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};

// One shared clock for every timestamp on the page, ticking every 30s; null while server rendering.
let clock = Date.now();
const ticks = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const subscribe = (tick: () => void) => {
  ticks.add(tick);
  if (!timer) {
    clock = Date.now();
    timer = setInterval(() => ((clock = Date.now()), ticks.forEach((t) => t())), 30_000);
  }
  return () => {
    ticks.delete(tick);
    if (!ticks.size) timer = void clearInterval(timer);
  };
};

/** "3m ago", counted on the viewer's clock and kept current while the page stays open. */
export function Ago({ at }: { at: number }) {
  const now = useSyncExternalStore(subscribe, () => clock, () => null);
  return <time dateTime={new Date(at).toISOString()} className="text-[12px] text-faint tabular-nums">{now === null ? "" : since(at, now)}</time>;
}

/** Follow the trader, open the transaction, copy the trade on Kadd testnet. */
export function PostActions({ trade }: { trade: { trader: string; tx: string; side: "buy" | "sell"; token: { address: string; symbol: string; image: string | null; price: number } } }) {
  const on = useStore().following.includes(trade.trader);
  return (
    <div className="flex items-center gap-1 text-muted">
      <button onClick={() => toggleFollow(trade.trader)} aria-pressed={on} aria-label={on ? "Unfollow trader" : "Follow trader"} title={on ? "Following: their trades show in your feed" : "Follow: get their trades in your feed"} className="grid place-items-center size-7 rounded-md hover:bg-hover hover:text-fg">
        <Star className={`size-3.5 ${on ? "fill-current text-warn" : ""}`} />
      </button>
      <a href={`https://monadscan.com/tx/${trade.tx}`} target="_blank" rel="noreferrer" aria-label="View transaction on Monadscan" title="View transaction" className="grid place-items-center size-7 rounded-md hover:bg-hover hover:text-fg">
        <ExternalLink className="size-3.5" />
      </a>
      <span className="ml-auto">
        <CopyButton side={trade.side} token={trade.token} />
      </span>
    </div>
  );
}
