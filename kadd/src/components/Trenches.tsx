"use client";
import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Flame, Search, SlidersHorizontal, Star, Zap } from "lucide-react";
import { usd, type Risk } from "@/lib/mock";
import { ageOf, type MarketToken, type MarketSnapshot } from "@/lib/market";
import { isWatched, toggleWatch, useStore } from "@/lib/store";
import { Pct, RiskBadge, TokenIcon } from "./ui";
import QuickBuy from "./QuickBuy";
import Onboarding from "./Onboarding";
import AutoRefresh from "./AutoRefresh";
import MarketStatus from "./MarketStatus";
import { usePracticeOneClick, setPracticeOneClick } from "@/lib/quickBuyPreference";

type Col = { key: string; title: string; hint: string } & MarketSnapshot;
const CATEGORIES = [{ key: "hot", label: "Hot right now" }, { key: "new", label: "New pairs" }, { key: "top", label: "Top volume" }];

function closeDisclosureOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== "Escape") return;
  event.currentTarget.open = false;
  event.currentTarget.querySelector("summary")?.focus();
}

function TokenCard({ token: t, amount, watched }: { token: MarketToken; amount: number; watched: boolean }) {
  return <article className="group min-w-0 rounded-xl border border-line bg-panel p-3 transition-colors hover:border-line-strong">
    <div className="flex items-start gap-2.5">
      <Link href={`/token/${t.address}`} aria-label={`Open ${t.name} (${t.symbol})`} className="min-w-0 flex flex-1 items-center gap-2.5 rounded-lg">
        <TokenIcon t={t} size={46} />
        <div className="min-w-0"><h2 title={t.symbol} className="truncate text-[14px] font-semibold tracking-tight">{t.symbol}</h2><p title={t.name} className="truncate text-[12px] text-muted">{t.name}</p></div>
      </Link>
      <button onClick={() => toggleWatch(t)} aria-pressed={watched} aria-label={`${watched ? "Remove" : "Add"} ${t.symbol} ${watched ? "from" : "to"} watchlist`} className={`grid size-11 md:size-8 shrink-0 place-items-center rounded-lg hover:bg-hover ${watched ? "text-brand" : "text-faint"}`}><Star className={`size-4 ${watched ? "fill-current" : ""}`} /></button>
    </div>
    <Link href={`/token/${t.address}`} aria-label={`View market details for ${t.symbol}`} className="mt-3 block rounded-md">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px] tabular-nums">
        <div><dt className="text-[10px] text-muted">Market cap / FDV</dt><dd className="font-semibold">{usd(t.mc)}</dd></div>
        <div className="text-right"><dt className="text-[10px] text-muted">Price change · 24h</dt><dd><Pct v={t.change.h24} className="font-medium" /></dd></div>
        <div><dt className="text-[10px] text-muted">Volume · 24h</dt><dd>{usd(t.vol.h24)}</dd></div>
        <div className="text-right"><dt className="text-[10px] text-muted">Liquidity</dt><dd>{usd(t.liq)}</dd></div>
      </dl>
    </Link>
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
      <div className="min-w-0"><RiskBadge risk={t.risk} /><p className="mt-1 text-[10px] text-muted" suppressHydrationWarning>{ageOf(t.createdAt)} old</p></div>
      <QuickBuy t={t} usd={amount} className="inline-flex min-h-11 md:min-h-9 max-w-[65%] items-center justify-center gap-1 rounded-lg border border-line px-2 text-[11px] font-semibold text-fg hover:bg-brand-fill/15 hover:border-brand/40" />
    </div>
  </article>;
}

export default function Trenches({ cols }: { cols: Col[] }) {
  const [category, setCategory] = useState("hot");
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<Risk | "all">("all");
  const [sort, setSort] = useState("default");
  const [watchOnly, setWatchOnly] = useState(false);
  const [amount, setAmount] = useState("10");
  const [auto, setAuto] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const oneClick = usePracticeOneClick();
  const store = useStore();
  const selected = cols.find((col) => col.key === category) ?? cols[0];
  const q = query.trim().toLowerCase();
  const tokens = selected.tokens.filter((t) => (risk === "all" || t.risk === risk) && (!watchOnly || isWatched(store, t.address)) && (!q || `${t.symbol} ${t.name} ${t.address}`.toLowerCase().includes(q)));
  if (sort !== "default") tokens.sort((a, b) => sort === "cap" ? b.mc - a.mc : sort === "volume" ? b.vol.h24 - a.vol.h24 : b.createdAt - a.createdAt);
  const reset = () => { setQuery(""); setRisk("all"); setSort("default"); setWatchOnly(false); };
  return <div className="mx-auto w-full max-w-[1800px] p-3 sm:p-5 lg:p-6">
    <AutoRefresh paused={!auto || hovering || focused} />
    <div className="mb-3 sm:mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">Trenches / Discover on Monad</p><h1 className="mt-1 text-[28px] font-semibold tracking-[-0.045em]">Find your next move<span className="text-brand">.</span></h1><p className="mt-1 hidden sm:block text-[12px] text-muted">Explore tokens. Check the risk. Practice your trade.</p></div>
      <Link href="/trending" className="hidden sm:inline-flex min-h-11 items-center gap-2 text-[12px] font-medium text-muted hover:text-fg"><Flame className="size-4" />Trending board<ArrowUpRight className="size-3.5" /></Link>
    </div>
    <Onboarding collapsed />
    <section aria-label="Discover tokens" className="mt-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <div className="flex min-w-0 max-w-full flex-1 sm:flex-none gap-1 overflow-x-auto" role="group" aria-label="Token category">
          {CATEGORIES.map((c) => <button key={c.key} aria-pressed={category === c.key} onClick={() => setCategory(c.key)} className={`shrink-0 min-h-11 md:min-h-9 rounded-lg px-2.5 sm:px-3 text-[12px] font-semibold ${category === c.key ? "bg-brand-fill text-[#0e1013]" : "text-muted hover:bg-hover hover:text-fg"}`}>{c.label}</button>)}
        </div>
        <button onClick={() => setWatchOnly(!watchOnly)} aria-label="Watchlist" aria-pressed={watchOnly} className={`inline-flex shrink-0 min-h-11 md:min-h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] ${watchOnly ? "bg-brand-fill/15 text-brand" : "text-muted hover:bg-hover"}`}><Star className="size-3.5" /><span className="hidden sm:inline">Watchlist</span></button>
        <label className="ml-auto flex min-h-11 md:min-h-9 w-full sm:w-60 items-center gap-2 rounded-lg border border-line bg-panel px-3 focus-within:border-line-strong"><Search className="size-3.5 shrink-0 text-muted" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter these tokens…" aria-label="Filter loaded tokens by name, symbol, or address" className="w-full min-w-0 bg-transparent text-[12px] outline-none placeholder:text-faint" /></label>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-2 py-3">
        <div className="min-w-0"><p className="text-[11px] text-muted"><span className="font-semibold text-fg">{tokens.length} tokens</span><span className="hidden sm:inline"> · {selected.hint}</span></p><MarketStatus data={selected} /></div>
        <div className="relative flex flex-wrap gap-2">
          <details onKeyDown={closeDisclosureOnEscape}><summary className="flex min-h-11 md:min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line px-3 text-[12px] text-muted"><SlidersHorizontal className="size-3.5" />Filters{risk !== "all" || sort !== "default" ? " · active" : ""}</summary>
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full z-20 mt-2 w-56 rounded-xl border border-line bg-panel p-3 shadow-lg">
              <label className="block text-[12px] text-muted">Risk<select value={risk} onChange={(e) => setRisk(e.target.value as Risk | "all")} className="mt-1 mb-3 h-11 w-full rounded-lg border border-line bg-panel px-2 text-fg"><option value="all">All risk levels</option><option value="safe">Low risk</option><option value="caution">Caution</option><option value="danger">High risk</option></select></label>
              <label className="block text-[12px] text-muted">Sort by<select value={sort} onChange={(e) => setSort(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-line bg-panel px-2 text-fg"><option value="default">Category order</option><option value="cap">Market cap / FDV</option><option value="volume">Volume · 24h</option><option value="newest">Newest</option></select></label>
              <button onClick={reset} className="mt-2 min-h-9 text-[12px] underline">Reset all filters</button>
            </div>
          </details>
          <details onKeyDown={closeDisclosureOnEscape}><summary className="flex min-h-11 md:min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line px-3 text-[12px] text-muted"><Zap className="size-3.5" />Quick Buy</summary>
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full z-20 mt-2 w-60 rounded-xl border border-line bg-panel p-3 shadow-lg">
              <label className="block text-[12px] text-muted">Practice amount · tUSDC<input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="mt-1 h-11 w-full rounded-lg border border-line bg-raised px-3 text-fg" /></label>
              <label className="mt-3 flex items-start gap-2 text-[12px] text-muted"><input type="checkbox" checked={oneClick} onChange={(e) => setPracticeOneClick(e.target.checked)} className="mt-0.5" />One-click for low-risk tokens. Skips review.</label>
              <p className="mt-2 text-[11px] text-muted">Other risk levels always require review.</p>
            </div>
          </details>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted"><p><span className="font-semibold text-brand">Practice</span> · Free tUSDC on testnet · Mainnet prices.</p><label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />{auto && (hovering || focused) ? "Updates paused while browsing" : "Auto-update · 30s"}</label></div>
      <div onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
        {selected.error ? <div role="alert" className="rounded-xl border border-line bg-panel p-8 text-center"><h2 className="font-semibold">Couldn’t load this category</h2><p className="mt-2 text-muted">Use Retry above to request market data again.</p></div>
          : tokens.length === 0 ? <div className="rounded-xl border border-dashed border-line-strong p-10 text-center"><h2 className="font-semibold">{selected.tokens.length ? "No tokens match your filters" : "No tokens in this category yet"}</h2><p className="mt-2 text-[12px] text-muted">{watchOnly ? "Watchlist only shows tokens loaded in this category. Try another category or turn off Watchlist." : "Try another category or refresh the market data."}</p>{selected.tokens.length > 0 && <button onClick={reset} className="mt-3 min-h-11 px-4 rounded-lg border border-line font-medium">Reset filters</button>}</div>
          : <div className="token-grid">{tokens.map((t) => <TokenCard key={t.address} token={t} amount={Number(amount) || 0} watched={isWatched(store, t.address)} />)}</div>}
      </div>
      <p className="mt-5 text-[10px] text-muted">Market data via GeckoTerminal / CoinGecko. Risk labels are screening signals, not guarantees.</p>
    </section>
  </div>;
}
