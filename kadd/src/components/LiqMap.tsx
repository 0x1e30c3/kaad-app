"use client";
import { useState } from "react";
import { liquidatedAt, type LiqBucket } from "@/lib/perplRisk";

type Market = { id: number; name: string; mark: number; liqMap: LiqBucket[] };
const compact = (n: number) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : n.toFixed(0));
const px = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 5 });
const MOVES = [2, 5, 10];

/**
 * Where open positions get liquidated, per market: bars by how far the price must move (longs below the mark, shorts
 * above), plus the cumulative amount a 2 / 5 / 10% move would wipe out. Built from every open position on Perpl.
 */
export default function LiqMap({ markets }: { markets: Market[] }) {
  const [id, setId] = useState(markets[0]?.id);
  const [hover, setHover] = useState<LiqBucket | null>(null);
  const m = markets.find((x) => x.id === id) ?? markets[0];
  if (!m) return null;
  const max = Math.max(1, ...m.liqMap.map((b) => b.longUsd + b.shortUsd));
  const shown = hover ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 px-1 flex gap-1.5 overflow-x-auto">
        {markets.map((x) => (
          <button key={x.id} onClick={() => setId(x.id)} className={`shrink-0 h-8 px-3 rounded-md text-[12px] font-semibold ${x.id === m.id ? "bg-fg text-bg" : "bg-raised text-muted hover:text-fg"}`}>
            {x.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {MOVES.map((pct) => (
          <div key={pct} className="rounded-lg bg-raised/60 p-3 flex flex-col gap-1 text-[12px] tabular-nums">
            <span className="text-muted">A {pct}% move in {m.name}</span>
            <span><b className="text-down">{compact(liquidatedAt(m.liqMap, -pct))}</b> <span className="text-muted">of longs if down</span></span>
            <span><b className="text-up">{compact(liquidatedAt(m.liqMap, pct))}</b> <span className="text-muted">of shorts if up</span></span>
          </div>
        ))}
      </div>

      <div>
        <div className="h-40 flex items-end gap-px" onMouseLeave={() => setHover(null)}>
          {m.liqMap.map((b) => {
            const usd = b.longUsd + b.shortUsd;
            return (
              <button
                key={b.move}
                type="button"
                onMouseEnter={() => setHover(b)}
                onFocus={() => setHover(b)}
                aria-label={`${b.move > 0 ? "+" : ""}${b.move}%: ${compact(usd)} liquidated`}
                className={`flex-1 min-w-0 rounded-t-sm ${b.move === 0 ? "bg-fg/60" : b.move < 0 ? "bg-down/70 hover:bg-down" : "bg-up/70 hover:bg-up"}`}
                style={{ height: b.move === 0 ? "100%" : `${Math.max(usd ? 3 : 0, (usd / max) * 100)}%`, opacity: b.move === 0 ? 0.25 : 1 }}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-faint tabular-nums">
          <span>−30%</span>
          <span>{m.name} {px(m.mark)}</span>
          <span>+30%</span>
        </div>
        <p className="mt-2 h-4 text-[12px] text-muted tabular-nums">
          {shown
            ? `At ${shown.move > 0 ? "+" : ""}${shown.move}% (${px(m.mark * (1 + shown.move / 100))}): ${compact(shown.longUsd + shown.shortUsd)} of ${shown.move < 0 ? "longs" : "shorts"} liquidated`
            : "Hover a bar: how much gets liquidated at that price."}
        </p>
      </div>
    </div>
  );
}
