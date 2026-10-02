"use client";
import { useState } from "react";
import Link from "next/link";
import { Activity, Droplet, SlidersHorizontal, Zap } from "lucide-react";
import { usd, type Risk } from "@/lib/mock";
import { ageOf, dexName, type MarketToken } from "@/lib/market";
import { RiskBadge, TokenIcon } from "./ui";
import CopyAddress from "./CopyAddress";
import QuickBuy from "./QuickBuy";
import Onboarding from "./Onboarding";

type Col = { key: string; title: string; hint: string; tokens: MarketToken[] };

function Card({ t, amount }: { t: MarketToken; amount: string }) {
  const tx = t.txns.h1;
  return (
    <div className="group relative flex gap-3 px-3 py-2.5 border-b border-line hover:bg-hover">
      <Link href={`/token/${t.address}`} className="absolute inset-0" aria-label={`Open ${t.symbol}`} />
      <TokenIcon t={t} size={44} />

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-semibold text-[14px] tracking-[-0.01em]">{t.symbol}</span>
          <span className="text-muted truncate">{t.name}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-muted">
          <span className="text-up font-medium tabular-nums" suppressHydrationWarning>{ageOf(t.createdAt)}</span>
          <span className="capitalize truncate">{dexName(t.dex)}</span>
          <span className="relative z-10"><CopyAddress address={t.address} /></span>
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-muted tabular-nums">
          <RiskBadge risk={t.risk} compact />
          <span className="inline-flex items-center gap-1" title="Liquidity"><Droplet className="size-3" />{usd(t.liq)}</span>
          <span className="inline-flex items-center gap-1" title="Buys / sells in the last hour">
            <Activity className="size-3" /><span className="text-up">{tx.buys}</span>/<span className="text-down">{tx.sells}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end justify-between text-[12px] tabular-nums">
        <div className="text-right leading-tight">
          <div><span className="text-faint text-[11px]">MC </span><span className="font-semibold">{usd(t.mc)}</span></div>
          <div><span className="text-faint text-[11px]">Vol 1h </span>{usd(t.vol.h1)}</div>
        </div>
        <QuickBuy t={t} usd={parseFloat(amount) || 0} label={amount} className="relative z-10 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-raised border border-line text-[11px] font-semibold hover:border-fg/40 hover:bg-hover" />
      </div>
    </div>
  );
}

const RISKS: [Risk, string][] = [["safe", "Low"], ["caution", "Caution"], ["danger", "High"]];

function Column({ col, hidden }: { col: Col; hidden: boolean }) {
  const [amount, setAmount] = useState("10");
  const [filterOpen, setFilterOpen] = useState(false);
  const [kw, setKw] = useState("");
  const [risks, setRisks] = useState<Risk[]>(["safe", "caution", "danger"]);
  const q = kw.trim().toLowerCase();
  const tokens = col.tokens.filter((t) => risks.includes(t.risk) && (!q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)));
  const filtered = tokens.length !== col.tokens.length;
  return (
    <section className={`${hidden ? "hidden" : "flex"} md:flex flex-1 min-w-0 md:min-w-[340px] flex-col rounded-lg border border-line bg-panel overflow-hidden`}>
      <header className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-line">
        <h2 className="font-semibold text-[13px]">{col.title}</h2>
        <span className="text-[11px] text-faint tabular-nums">{tokens.length}</span>
        <label className="ml-auto flex items-center gap-1 h-7 pl-2 pr-1 rounded-md bg-raised text-muted focus-within:ring-1 focus-within:ring-line-strong" title="Quick buy amount (tUSDC, Monad testnet)">
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
          className={`relative grid place-items-center size-7 rounded-md hover:bg-hover ${filterOpen ? "bg-hover text-fg" : "text-muted hover:text-fg"}`}
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
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted mr-1">Risk</span>
            {RISKS.map(([r, label]) => {
              const on = risks.includes(r);
              return (
                <button
                  key={r}
                  aria-pressed={on}
                  onClick={() => setRisks(on ? risks.filter((x) => x !== r) : [...risks, r])}
                  className={`h-7 px-2.5 rounded-md border text-[12px] ${on ? "border-fg/40 text-fg bg-panel" : "border-line text-faint"}`}
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
      <p className="px-3 py-1.5 text-[11px] text-faint border-b border-line">{col.hint}</p>
      <div className="flex-1 overflow-auto">
        {tokens.map((t) => <Card key={t.address} t={t} amount={amount || "0"} />)}
        {tokens.length === 0 && <p className="p-6 text-center text-muted">{col.tokens.length ? "No tokens match the filter." : "Nothing here right now."}</p>}
      </div>
    </section>
  );
}

export default function Trenches({ cols }: { cols: Col[] }) {
  const [tab, setTab] = useState(cols[0].key);
  return (
    <div className="h-full flex flex-col gap-2 p-2 md:p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1 px-1 rounded bg-up/15 text-up font-semibold"><span className="size-1.5 rounded-full bg-up animate-pulse" />LIVE</span>
        Monad mainnet data, refreshed every 30s. Quick buy trades a testnet mirror of the token with free test USDC.
      </p>
      <Onboarding />
      <div className="md:hidden grid grid-cols-3 p-0.5 rounded-lg bg-raised">
        {cols.map((c) => (
          <button
            key={c.key}
            onClick={() => setTab(c.key)}
            className={`h-8 rounded-md text-[12px] font-medium ${tab === c.key ? "bg-panel text-fg shadow-sm" : "text-muted"}`}
          >
            {c.title}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 flex gap-2 md:gap-3">
        {cols.map((c) => <Column key={c.key} col={c} hidden={tab !== c.key} />)}
      </div>
    </div>
  );
}
