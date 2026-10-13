import Link from "next/link";
import { smartMoney } from "@/lib/nansen";
import { perpBoard } from "@/lib/perpl";
import { pnlUsd, short } from "@/lib/mock";
import WalletAvatar from "./WalletAvatar";

type Item = { address: string; name: string; pnl: number; note: string };

/** Biggest winners right now: Nansen smart money on Monad (30d PnL) and Perpl traders, together. */
async function winners(): Promise<Item[]> {
  const [sm, perps] = await Promise.all([smartMoney(), perpBoard().catch(() => null)]);
  const smart = (sm?.wallets ?? []).map((w) => ({ address: w.address, name: w.label ?? short(w.address), pnl: w.totalPnlUsd, note: "Smart money · 30d PnL (Nansen)" }));
  // All-time PnL needs the indexer; without it, open (unrealized) PnL.
  const perp = (perps?.rows ?? []).map((r) => ({ address: r.address, name: short(r.address), pnl: perps?.history ? (r.allTime ?? 0) : r.unrealized, note: perps?.history ? "Perpl · all-time PnL" : "Perpl · open PnL" }));
  return [...smart, ...perp].filter((w) => w.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 24);
}

/** A thin, endlessly scrolling strip of top wallets under the top bar. Pauses on hover; static with reduced motion. */
export default async function TickerStrip() {
  const top = await winners().catch((): Item[] => []);
  if (!top.length) return null;
  // Repeat a short list so one copy is always wider than the screen and the loop never shows a gap.
  const items = Array.from({ length: Math.ceil(16 / top.length) }, () => top).flat();
  const row = (hidden: boolean) =>
    items.map((w, i) => (
      <Link key={`${w.address}-${i}`} href={`/wallet/${w.address}`} title={w.note} tabIndex={hidden || i >= top.length ? -1 : undefined} className="flex items-center gap-1.5 px-3 h-full whitespace-nowrap hover:bg-hover">
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
