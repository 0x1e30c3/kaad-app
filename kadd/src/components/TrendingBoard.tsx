"use client";
import { useState } from "react";
import Link from "next/link";
import { Activity, Droplet, SlidersHorizontal, Zap } from "lucide-react";
import { usd, type Risk } from "@/lib/mock";
import { ageOf, dexName, type MarketToken, type MarketSnapshot } from "@/lib/market";
import { RiskBadge, TokenIcon } from "./ui";
import CopyAddress from "./CopyAddress";
import QuickBuy from "./QuickBuy";
import MarketStatus from "./MarketStatus";
import AutoRefresh from "./AutoRefresh";
import { isWatched, useStore } from "@/lib/store";

import { usePracticeOneClick, setPracticeOneClick } from "@/lib/quickBuyPreference";

type Col = { key: string; title: string; hint: string; } & MarketSnapshot;

function Card({ t, amount }: { t: MarketToken; amount: string }) {
  const tx = t.txns.h1;
  return (
    <div className="group relative grid grid-cols-[44px_minmax(0,1fr)] gap-3 px-3 py-2.5 border-b border-line hover:bg-hover">
      <Link href={`/token/${t.address}`} className="absolute inset-0" aria-label={`Open ${t.symbol}`} />
      <TokenIcon t={t} size={44} />

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="max-w-24 truncate font-semibold text-[14px] tracking-[-0.01em]">{t.symbol}</span>
          <span className="text-muted truncate">{t.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted">
          <span className="text-up font-medium tabular-nums" suppressHydrationWarning>{ageOf(t.createdAt)}</span>
          <span className="capitalize truncate">{dexName(t.dex)}</span>
          <span className="relative z-10"><CopyAddress address={t.address} /></span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted tabular-nums">
          <RiskBadge risk={t.risk} />
          <span className="inline-flex items-center gap-1" title="Liquidity"><Droplet className="size-3" />{usd(t.liq)}</span>
          <span className="inline-flex items-center gap-1" title="Buys / sells in the last hour">
            <Activity className="size-3" /><span className="text-up">{tx.buys}</span>/<span className="text-down">{tx.sells}</span>
          </span>
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between gap-2 text-[12px] tabular-nums">
        <div className="leading-tight">
          <div><span className="text-faint text-[11px]">MC </span><span className="font-semibold">{usd(t.mc)}</span></div>
          <div><span className="text-faint text-[11px]">Vol 1h </span>{usd(t.vol.h1)}</div>
        </div>
        <QuickBuy t={t} usd={parseFloat(amount) || 0} className="relative z-10 inline-flex items-center gap-1 min-h-11 md:min-h-9 px-2 rounded-md bg-raised border border-line text-[11px] font-semibold hover:border-fg/40 hover:bg-hover" />
      </div>
    </div>
  );
}

const RISKS: [Risk, string][] = [["safe", "Low"], ["caution", "Caution"], ["danger", "High"]];

function Column({ col, hidden, watchOnly }: { col: Col; hidden: boolean; watchOnly: boolean }) {
  const store = useStore();
  const [amount, setAmount] = useState("10");
  const [filterOpen, setFilterOpen] = useState(false);
  const [kw, setKw] = useState("");
  const [risks, setRisks] = useState<Risk[]>(["safe", "caution", "danger"]);
  const q = kw.trim().toLowerCase();
  const tokens = col.tokens.filter((t) => (!watchOnly || isWatched(store, t.address)) && risks.includes(t.risk) && (!q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)));
  const filtered = tokens.length !== col.tokens.length;
  return (
    <section data-hidden={hidden} className={`market-column flex-col rounded-lg border border-line bg-panel overflow-hidden`}>
      <header className="min-h-12 shrink-0 flex flex-wrap items-center gap-2 px-3 border-b border-line">
        <h2 className="font-semibold text-[13px]">{col.title}</h2>
        <span className="text-[11px] text-faint tabular-nums">{tokens.length}</span>
        <label className="ml-auto flex items-center gap-1 min-h-11 md:min-h-8 pl-2 pr-1 rounded-md bg-raised text-muted focus-within:ring-1 focus-within:ring-line-strong" title="Quick buy amount (tUSDC, Monad testnet)">
          <Zap className="size-3" />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            aria-label="Quick buy amount in tUSDC"
            className="w-10 bg-transparent outline-none text-fg font-medium tabular-nums"
          />
        </label>
        <button
          aria-label="Filter"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(!filterOpen)}
          className={`relative grid place-items-center size-11 md:size-8 rounded-md hover:bg-hover ${filterOpen ? "bg-hover text-fg" : "text-muted hover:text-fg"}`}
        >
          <SlidersHorizontal className="size-3.5" />
          {filtered && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-brand" />}
        </button>
      </header>
      {filterOpen && (
        <div className="flex flex-col gap-2 px-3 py-2.5 border-b border-line bg-raised/50">
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="Keyword (name / symbol)"
            aria-label="Filter by keyword"
            className="h-8 px-2.5 rounded-md bg-panel border border-line outline-none focus:border-line-strong placeholder:text-faint"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted mr-1">Risk</span>
            {RISKS.map(([r, label]) => {
              const on = risks.includes(r);
              return (
                <button
                  key={r}
                  aria-pressed={on}
                  onClick={() => setRisks(on ? risks.filter((x) => x !== r) : [...risks, r])}
                  className={`min-h-11 md:min-h-8 px-2.5 rounded-md border text-[12px] ${on ? "border-fg/40 text-fg bg-panel" : "border-line text-faint"}`}
                >
                  {label}
                </button>
              );
            })}
            {filtered && (
              <button onClick={() => (setKw(""), setRisks(["safe", "caution", "danger"]))} className="ml-auto text-[12px] text-muted hover:text-fg">
                Reset
              </button>
            )}
          </div>
        </div>
      )}
      <div className="px-3 py-1 border-b border-line"><MarketStatus data={col} /></div>
      <p className="px-3 py-1.5 text-[11px] text-faint border-b border-line">{col.hint}</p>
      <div className="min-h-0 flex-1 overflow-auto">
        {tokens.map((t) => <Card key={t.address} t={t} amount={amount || "0"} />)}
        {!col.error && tokens.length === 0 && <p className="p-6 text-center text-muted">{col.tokens.length ? "No tokens match the filter." : "Nothing here right now."}</p>}
      </div>
    </section>
  );
}

export default function TrendingBoard({ cols }: { cols: Col[] }) {
  const [watchOnly, setWatchOnly] = useState(false);
  const [auto, setAuto] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const oneClick = usePracticeOneClick();
  const [tab, setTab] = useState(cols[0].key);
  return (
    <div className="market-board min-h-full flex flex-col gap-3 p-3 md:p-5">
      <AutoRefresh paused={!auto || hovering || focused} />
      <div><p className="text-[11px] text-brand font-semibold uppercase tracking-widest">Market pulse</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Trending</h1><p className="mt-1 text-muted">Follow new pairs, momentum, and volume side by side.</p></div>
      <p className="text-[11px] text-muted">Practice · Quick Buy uses free tUSDC on Monad testnet. Market data: Monad mainnet (GeckoTerminal / CoinGecko), refresh attempted every 30s.</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <label className="flex min-h-9 items-center gap-2 text-[11px] text-muted"><input type="checkbox" checked={watchOnly} onChange={(e) => setWatchOnly(e.target.checked)} />Watchlist only</label>
      <label className="flex min-h-9 items-center gap-2 text-[11px] text-muted"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />{auto && (hovering || focused) ? "Updates paused while browsing" : "Auto-update · 30s"}</label>
      <label className="flex min-h-9 items-center gap-2 text-[11px] text-muted">
        <input type="checkbox" checked={oneClick} onChange={(e) => {
          setPracticeOneClick(e.target.checked);
        }} /> Enable one-click practice buys for low-risk tokens (skip review)
      </label>
      </div>

      <div className="market-column-tabs grid grid-cols-3 p-0.5 rounded-lg bg-raised">
        {cols.map((c) => (
          <button
            key={c.key}
            aria-pressed={tab === c.key}
            onClick={() => setTab(c.key)}
            className={`min-h-11 rounded-md text-[12px] font-medium ${tab === c.key ? "bg-panel text-fg shadow-sm" : "text-muted"}`}
          >
            {c.title}
          </button>
        ))}
      </div>
      <div className="market-columns flex-1" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
        {cols.map((c) => <Column key={c.key} col={c} hidden={tab !== c.key} watchOnly={watchOnly} />)}
      </div>
    </div>
  );
}
