"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { num, usd } from "@/lib/mock";
import { FRAMES, FRAME_LABEL, ageOf, type Frame, type MarketToken } from "@/lib/market";
import { isWatched, toggleWatch, useStore } from "@/lib/store";
import { Pct, RiskBadge, TokenIcon } from "./ui";
import CopyAddress from "./CopyAddress";
import QuickBuy from "./QuickBuy";

type Key = "mc" | "change" | "liq" | "vol" | "tx" | "age";
const COLS: [Key, string, string][] = [
  ["mc", "Market cap", ""],
  ["change", "Change", ""],
  ["liq", "Liquidity", "hidden lg:table-cell"],
  ["vol", "Volume", ""],
  ["tx", "Txns", "hidden md:table-cell"],
  ["age", "Age", "hidden lg:table-cell"],
];
const val = (t: MarketToken, k: Key, f: Frame) =>
  k === "tx" ? t.txns[f].buys + t.txns[f].sells : k === "change" ? t.change[f] : k === "vol" ? t.vol[f] : k === "age" ? -t.createdAt : t[k];

export default function TrendingTable({ tokens }: { tokens: MarketToken[] }) {
  const [sort, setSort] = useState<[Key, 1 | -1]>(["vol", -1]);
  const [frame, setFrame] = useState<Frame>("h24");
  const [onlyWatch, setOnlyWatch] = useState(false);
  const s = useStore();
  const rows = tokens
    .filter((t) => !onlyWatch || isWatched(s, t.address))
    .sort((a, b) => (val(a, sort[0], frame) - val(b, sort[0], frame)) * sort[1]);

  return (
    <div className="p-2 md:p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em]">Trending</h1>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-up/15 text-up text-[10px] font-semibold" title="Monad mainnet data via GeckoTerminal">
          <span className="size-1.5 rounded-full bg-up animate-pulse" /> LIVE · MAINNET
        </span>
        <button
          onClick={() => setOnlyWatch(!onlyWatch)}
          aria-pressed={onlyWatch}
          className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[12px] font-medium ${onlyWatch ? "border-warn/50 text-warn" : "border-line text-muted hover:text-fg"}`}
        >
          <Star className={`size-3 ${onlyWatch ? "fill-current" : ""}`} /> Watchlist {s.watchlist.length > 0 && <span className="tabular-nums">{s.watchlist.length}</span>}
        </button>
        <div className="ml-auto flex p-0.5 rounded-lg bg-raised text-[12px] font-medium">
          {FRAMES.map((f) => (
            <button
              key={f}
              onClick={() => setFrame(f)}
              className={`h-7 px-3 rounded-md tabular-nums ${frame === f ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`}
            >
              {FRAME_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-panel overflow-auto">
        <table className="w-full text-[13px] tabular-nums">
          <thead className="sticky top-0 z-10 bg-panel text-[11px] text-muted">
            <tr className="border-b border-line">
              <th className="w-8" />
              <th className="text-left font-medium px-3 py-2.5">Token</th>
              {COLS.map(([k, label, cls]) => (
                <th key={k} className={`text-right font-medium px-3 ${cls}`}>
                  <button
                    onClick={() => setSort([k, sort[0] === k ? (-sort[1] as 1 | -1) : -1])}
                    className={`inline-flex items-center gap-1 hover:text-fg ${sort[0] === k ? "text-fg" : ""}`}
                  >
                    {label}
                    {sort[0] === k && (sort[1] < 0 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                  </button>
                </th>
              ))}
              <th className="text-left font-medium px-3 hidden sm:table-cell">Risk</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const starred = isWatched(s, t.address);
              const tx = t.txns[frame];
              return (
                <tr key={t.address} className="group relative border-b border-line last:border-0 hover:bg-hover">
                  <td className="pl-3">
                    <button
                      aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
                      onClick={() => toggleWatch(t)}
                      className={`relative z-10 grid place-items-center ${starred ? "text-warn" : "text-faint hover:text-fg"}`}
                    >
                      <Star className={`size-3.5 ${starred ? "fill-current" : ""}`} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/token/${t.address}`} className="absolute inset-0" aria-label={`Open ${t.symbol}`} />
                    <div className="flex items-center gap-2.5">
                      <TokenIcon t={t} size={34} />
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-semibold">{t.symbol}</span>
                          <span className="text-muted text-[12px] truncate max-w-28">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="relative z-10"><CopyAddress address={t.address} /></span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 text-right font-semibold">{usd(t.mc)}</td>
                  <td className="px-3 text-right"><Pct v={t.change[frame]} /></td>
                  <td className="px-3 text-right hidden lg:table-cell">{usd(t.liq)}</td>
                  <td className="px-3 text-right">{usd(t.vol[frame])}</td>
                  <td className="px-3 text-right hidden md:table-cell">
                    <div>{num(tx.buys + tx.sells)}</div>
                    <div className="text-[11px]"><span className="text-up">{tx.buys}</span><span className="text-faint"> / </span><span className="text-down">{tx.sells}</span></div>
                  </td>
                  <td className="px-3 text-right hidden lg:table-cell text-muted" suppressHydrationWarning>{ageOf(t.createdAt)}</td>
                  <td className="px-3 hidden sm:table-cell"><RiskBadge risk={t.risk} /></td>
                  <td className="pr-3 text-right">
                    <QuickBuy t={t} usd={10} className="relative z-10 inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-brand-fill text-[#0a0a0a] text-[12px] font-semibold hover:brightness-95" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-muted">{onlyWatch ? "None of your watchlist is trending. Star tokens with ★ to track them." : "No trending tokens right now."}</p>}
      </div>
    </div>
  );
}
