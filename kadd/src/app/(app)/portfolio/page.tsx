"use client";
import Link from "next/link";
import { ArrowRight, Droplets, ExternalLink, Fuel, Loader2, Star, Wallet } from "lucide-react";
import { useState } from "react";
import { num, usd } from "@/lib/mock";
import { toggleWatch, useStore } from "@/lib/store";
import { faucet, requestGas, sellToken, useWallet } from "@/lib/swap";
import { useQuotes } from "@/lib/useQuotes";
import { EXPLORER } from "@/lib/venue";
import { PageHeader, Panel, PanelEmpty, Pct, StatusPill, TokenIcon, card, hueOf } from "@/components/ui";
import LoginGate from "@/components/LoginGate";
import SecurityPanel from "@/components/SecurityPanel";
import InviteCard from "@/components/InviteCard";
import StrategiesList from "@/components/StrategiesList";
import { CopyVaults } from "@/components/AutoCopy";

export default function PortfolioPage() {
  const { user, costs, fills, watchlist } = useStore();
  const wallet = useWallet();
  const quotes = useQuotes([...watchlist.map((t) => t.address), ...(wallet?.holdings ?? []).map((h) => h.market.source)]);
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  if (!user)
    return (
      <div className="p-3 md:p-5">
        <PageHeader title="Portfolio" />
        <LoginGate icon={Wallet} title="See your portfolio" desc="Sign in to see your balance, positions, PnL and trade history." />
      </div>
    );

  const rows = (wallet?.holdings ?? []).map((h) => {
    const source = h.market.source.toLowerCase();
    const cost = costs[source] ?? 0;
    const pnl = cost ? h.value - cost : null;
    return { ...h, source, cost, pnl };
  });
  const holdings = rows.reduce((s, r) => s + r.value, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const pnl = holdings - cost;

  return (
    <div className="p-3 md:p-5 flex flex-col gap-4">
      <PageHeader title="Portfolio" desc="Balances are read from Monad testnet and valued at the testnet pool price. Test tokens only." />

      {/* Hero: what you own, how it's split, what to do next */}
      <section className={`${card} -mt-2 p-5 grid gap-5 lg:grid-cols-[1fr_auto]`}>
        <div className="min-w-0">
          <div className="text-[12px] text-muted">Total value</div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[34px] font-semibold tabular-nums tracking-[-0.03em] leading-tight">{wallet ? usd(wallet.usdc + holdings) : "…"}</span>
            {wallet && cost > 0 && (
              <StatusPill tone={pnl >= 0 ? "up" : "down"}>
                {pnl >= 0 ? "+" : "-"}{usd(Math.abs(pnl))} · {((pnl / cost) * 100).toFixed(1)}%
              </StatusPill>
            )}
          </div>
          {wallet && (
            <>
              <div className="mt-4 flex h-2.5 rounded-full overflow-hidden bg-raised">
                {[{ key: "tUSDC", value: wallet.usdc, color: "var(--muted)" }, ...rows.map((r) => ({ key: r.market.symbol, value: r.value, color: `hsl(${hueOf(r.source)} 55% 50%)` }))]
                  .filter((x) => x.value > 0)
                  .map((x) => (
                    <span key={x.key} title={`${x.key} ${usd(x.value)}`} style={{ width: `${(x.value / (wallet.usdc + holdings || 1)) * 100}%`, background: x.color }} />
                  ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted tabular-nums">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted" />tUSDC {wallet.usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                {rows.map((r) => (
                  <span key={r.market.address} className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: `hsl(${hueOf(r.source)} 55% 50%)` }} />
                    {r.market.symbol} {usd(r.value)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2 lg:w-64">
          <div className="grid grid-cols-2 gap-2 text-[12px] tabular-nums">
            <div className="rounded-lg bg-raised px-3 py-2">
              <div className="text-muted">tUSDC</div>
              <div className="font-semibold">{wallet ? wallet.usdc.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "…"}</div>
            </div>
            <div className="rounded-lg bg-raised px-3 py-2">
              <div className="text-muted">MON for gas</div>
              <div className={`font-semibold ${wallet && wallet.mon < 0.05 ? "text-down" : ""}`}>{wallet ? wallet.mon.toFixed(3) : "…"}</div>
            </div>
          </div>
          <button onClick={() => act("faucet", faucet)} disabled={!!busy} className="h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-fill text-[#0a0a0a] text-[13px] font-semibold hover:brightness-95 disabled:opacity-50">
            {busy === "faucet" ? <Loader2 className="size-3.5 animate-spin" /> : <Droplets className="size-3.5" />} Get 1,000 test USDC
          </button>
          {wallet && wallet.mon < 0.05 ? (
            <button onClick={() => act("gas", () => requestGas(user.address))} disabled={!!busy} className="h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line-strong text-[13px] font-semibold hover:bg-hover disabled:opacity-50">
              {busy === "gas" ? <Loader2 className="size-3.5 animate-spin" /> : <Fuel className="size-3.5" />} Get gas
            </button>
          ) : (
            <Link href="/trenches" className="h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line-strong text-[13px] font-semibold hover:bg-hover">
              Find tokens <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="text-[15px] font-semibold">Positions</h2>
          <span className="text-[13px] text-faint tabular-nums">{rows.length}</span>
        </div>
        {!wallet ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-xl border border-line bg-panel animate-pulse" />)}</div>
        ) : rows.length === 0 ? (
          <div className={`${card} p-5 flex flex-col sm:flex-row sm:items-center gap-4`}>
            <div className="flex-1">
              <div className="font-semibold">No positions yet</div>
              <p className="text-[13px] text-muted">Pick a token in Trenches and buy $10 worth. It settles on Monad testnet in under a second.</p>
            </div>
            <Link href="/trenches" className="h-9 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-fill text-[#0a0a0a] text-[13px] font-semibold hover:brightness-95">
              Open Trenches <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {rows.map((r) => {
              const q = quotes[r.source];
              const t = { address: r.source, symbol: r.market.symbol, name: r.market.symbol, image: q?.image ?? fills.find((f) => f.address === r.source)?.image ?? null };
              const weight = (r.value / (wallet.usdc + holdings || 1)) * 100;
              return (
                <article key={r.market.address} className={`${card} p-5 gap-4`}>
                  <div className="flex items-center gap-3">
                    <TokenIcon t={t} size={40} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/token/${r.source}`} className="block text-[16px] font-semibold leading-tight hover:underline after:absolute after:inset-0">{r.market.symbol}</Link>
                      <div className="mt-0.5 text-[12px] text-muted tabular-nums">{num(r.amount)} tokens</div>
                    </div>
                    {q && <span className="text-right text-[11px] text-muted leading-tight">mainnet 24h<br /><Pct v={q.change24h} className="text-[12px] font-semibold" /></span>}
                  </div>
                  <div>
                    <div className="text-[12px] text-muted">Value</div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[28px] font-semibold tabular-nums tracking-[-0.02em]">{usd(r.value)}</span>
                      {r.pnl !== null && (
                        <StatusPill tone={r.pnl >= 0 ? "up" : "down"}>
                          {r.pnl >= 0 ? "▲" : "▼"} {usd(Math.abs(r.pnl))} · {Math.abs((r.pnl / r.cost) * 100).toFixed(1)}%
                        </StatusPill>
                      )}
                    </div>
                  </div>
                  <dl className="flex flex-col gap-2 text-[13px] tabular-nums">
                    <div className="flex items-center gap-2">
                      <dt className="text-muted">Share of portfolio</dt>
                      <dd className="ml-auto flex items-center gap-2">
                        <span className="w-16 h-1.5 rounded-full bg-raised overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${weight}%`, background: `hsl(${hueOf(r.source)} 55% 50%)` }} /></span>
                        <span className="w-9 text-right font-medium">{weight.toFixed(0)}%</span>
                      </dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <dt className="text-muted">Cost basis</dt>
                      <dd className="ml-auto font-medium">{r.cost ? usd(r.cost) : "–"}</dd>
                    </div>
                  </dl>
                  <div className="relative z-10 mt-auto flex items-center gap-1.5 pt-4 border-t border-line">
                    <Link href={`/token/${r.source}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-fg">
                      Trade <ArrowRight className="size-3.5" />
                    </Link>
                    <button onClick={() => act(`h${r.market.address}`, () => sellToken(t, 50))} disabled={!!busy} className="ml-auto h-8 px-2.5 rounded-lg border border-line text-[12px] font-medium hover:bg-hover disabled:opacity-40">
                      {busy === `h${r.market.address}` ? <Loader2 className="inline size-3 animate-spin" /> : "Sell 50%"}
                    </button>
                    <button onClick={() => act(r.market.address, () => sellToken(t, 100))} disabled={!!busy} className="h-8 px-2.5 rounded-lg border border-line text-[12px] font-medium hover:bg-hover disabled:opacity-40">
                      {busy === r.market.address ? <Loader2 className="inline size-3 animate-spin" /> : "Sell all"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="flex flex-col gap-4">
      <CopyVaults />
      <StrategiesList />

      <Panel title="Trade history" count={fills.length || undefined}>
        {fills.length === 0 ? (
          <PanelEmpty>No trades yet. Your buys and sells show up here with a link to each transaction.</PanelEmpty>
        ) : (
          <ul className="tabular-nums">
            {fills.slice(0, 30).map((f) => (
              <li key={f.hash} className="flex items-center gap-3 px-4 py-2 border-b border-line last:border-0 text-[13px]">
                <span className={`w-9 font-medium ${f.side === "buy" ? "text-up" : "text-down"}`}>{f.side === "buy" ? "Buy" : "Sell"}</span>
                <span className="flex-1 font-semibold">{f.symbol}</span>
                <span className="text-muted hidden sm:inline">{num(f.amount)}</span>
                <span className="w-20 text-right">{usd(f.usd)}</span>
                <a href={`${EXPLORER}/tx/${f.hash}`} target="_blank" rel="noreferrer" className="w-16 inline-flex items-center justify-end gap-1 text-faint text-[11px] hover:text-fg">
                  {new Date(f.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      </div>

      <div className="flex flex-col gap-4">
      <section id="watchlist" className="scroll-mt-4">
      <Panel title="Watchlist" count={watchlist.length}>
        {watchlist.length === 0 ? (
          <PanelEmpty>Star a token with ★ on its page to keep it here.</PanelEmpty>
        ) : (
          <ul className="grid gap-2 p-3 sm:grid-cols-2">
            {watchlist.map((t) => {
              const q = quotes[t.address];
              return (
                <li key={t.address} className="relative flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 hover:border-line-strong">
                  <TokenIcon t={t} size={32} />
                  <Link href={`/token/${t.address}`} className="min-w-0 flex-1 after:absolute after:inset-0">
                    <span className="block font-semibold leading-tight">{t.symbol}</span>
                    <span className="block text-[12px] text-muted tabular-nums">{q ? `MC ${usd(q.mc)}` : "…"}</span>
                  </Link>
                  {q && <Pct v={q.change24h} className="text-[12px] font-medium" />}
                  <button onClick={() => toggleWatch(t)} aria-label="Remove from watchlist" className="relative z-10 text-warn hover:opacity-70"><Star className="size-4 fill-current" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      </section>

      <InviteCard />
      <SecurityPanel />
      </div>
      </div>
    </div>
  );
}
