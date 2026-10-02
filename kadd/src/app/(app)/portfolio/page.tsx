"use client";
import Link from "next/link";
import { Droplets, ExternalLink, FlaskConical, Loader2, Star, Wallet } from "lucide-react";
import { useState } from "react";
import { num, usd } from "@/lib/mock";
import { toggleWatch, useStore } from "@/lib/store";
import { faucet, sellToken, useWallet } from "@/lib/swap";
import { useQuotes } from "@/lib/useQuotes";
import { EXPLORER } from "@/lib/venue";
import { PageHeader, Pct, TokenIcon } from "@/components/ui";
import LoginGate from "@/components/LoginGate";
import SecurityPanel from "@/components/SecurityPanel";
import StrategiesList from "@/components/StrategiesList";

function Card({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg border border-line bg-panel">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em]">{value}</div>
      {sub && <div className="text-[12px] tabular-nums">{sub}</div>}
    </div>
  );
}

export default function PortfolioPage() {
  const { user, costs, fills, watchlist } = useStore();
  const wallet = useWallet();
  const quotes = useQuotes(watchlist.map((t) => t.address));
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  if (!user)
    return (
      <div className="p-3 md:p-5 max-w-5xl mx-auto">
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
    <div className="p-3 md:p-5 max-w-5xl mx-auto flex flex-col gap-6">
      <PageHeader title="Portfolio" desc="Your balance, open positions and trade history." />
      <p className="-mt-4 flex items-start gap-2 p-3 rounded-lg bg-warn/10 text-warn text-[12px]">
        <FlaskConical className="size-4 shrink-0" />
        Monad testnet: balances are read from chain and valued at the testnet pool price. Test tokens only, no real value.
      </p>

      <div className="grid gap-3 sm:grid-cols-3 -mt-2">
        <Card label="Total value" value={wallet ? usd(wallet.usdc + holdings) : "…"} />
        <Card
          label="tUSDC balance"
          value={wallet ? wallet.usdc.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "…"}
          sub={
            <button onClick={() => act("faucet", faucet)} disabled={!!busy} className="mt-1 inline-flex items-center gap-1 text-muted hover:text-fg disabled:opacity-40">
              {busy === "faucet" ? <Loader2 className="size-3 animate-spin" /> : <Droplets className="size-3" />} Get 1,000 free
            </button>
          }
        />
        <Card
          label="Unrealized PnL"
          value={!wallet ? "…" : <span className={pnl >= 0 ? "text-up" : "text-down"}>{pnl >= 0 ? "+" : "-"}{usd(Math.abs(pnl))}</span>}
          sub={wallet && cost > 0 && <Pct v={(pnl / cost) * 100} />}
        />
      </div>

      <section className="rounded-lg border border-line bg-panel overflow-x-auto">
        <h2 className="px-4 h-11 flex items-center font-semibold border-b border-line">Positions <span className="ml-1.5 text-faint font-normal">{rows.length}</span></h2>
        {!wallet ? (
          <div className="h-24 grid place-items-center text-muted"><Loader2 className="size-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-muted">No positions yet. <Link href="/trenches" className="text-fg underline">Find a token in Trenches</Link></p>
        ) : (
          <table className="w-full tabular-nums">
            <thead className="text-[11px] text-muted">
              <tr className="border-b border-line">
                <th className="text-left font-medium px-4 py-2">Token</th>
                <th className="text-right font-medium px-3 hidden sm:table-cell">Amount</th>
                <th className="text-right font-medium px-3">Value</th>
                <th className="text-right font-medium px-3">PnL</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = { address: r.source, symbol: r.market.symbol, name: r.market.symbol, image: fills.find((f) => f.address === r.source)?.image ?? null };
                return (
                  <tr key={r.market.address} className="border-b border-line last:border-0 hover:bg-hover">
                    <td className="px-4 py-2.5">
                      <Link href={`/token/${r.source}`} className="flex items-center gap-2.5">
                        <TokenIcon t={t} size={30} />
                        <div>
                          <div className="font-semibold">{r.market.symbol}</div>
                          <div className="text-[11px] text-muted">{r.cost ? `Cost ${usd(r.cost)}` : "Testnet mirror"}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 text-right hidden sm:table-cell">{num(r.amount)}</td>
                    <td className="px-3 text-right">{usd(r.value)}</td>
                    <td className={`px-3 text-right ${r.pnl === null ? "text-faint" : r.pnl >= 0 ? "text-up" : "text-down"}`}>
                      {r.pnl === null ? "–" : (
                        <>
                          <div>{r.pnl >= 0 ? "+" : "-"}{usd(Math.abs(r.pnl))}</div>
                          <Pct v={(r.pnl / r.cost) * 100} className="text-[11px]" />
                        </>
                      )}
                    </td>
                    <td className="pr-4 text-right">
                      <button
                        onClick={() => act(r.market.address, () => sellToken(t, 100))}
                        disabled={!!busy}
                        className="h-7 px-2.5 rounded-md border border-line-strong text-[12px] font-semibold whitespace-nowrap hover:bg-hover disabled:opacity-40 inline-flex items-center gap-1"
                      >
                        {busy === r.market.address && <Loader2 className="size-3 animate-spin" />} Sell all
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section id="watchlist" className="rounded-lg border border-line bg-panel overflow-hidden scroll-mt-4">
        <h2 className="px-4 h-11 flex items-center font-semibold border-b border-line">Watchlist <span className="ml-1.5 text-faint font-normal">{watchlist.length}</span></h2>
        {watchlist.length === 0 ? (
          <p className="p-6 text-center text-muted">Star a token with ★ to keep it here.</p>
        ) : (
          <ul>
            {watchlist.map((t) => {
              const q = quotes[t.address];
              return (
                <li key={t.address} className="flex items-center gap-3 px-4 py-2 border-b border-line last:border-0 hover:bg-hover">
                  <Link href={`/token/${t.address}`} className="flex flex-1 min-w-0 items-center gap-2.5">
                    <TokenIcon t={t} size={28} />
                    <span className="font-semibold">{t.symbol}</span>
                    <span className="text-muted truncate">{t.name}</span>
                  </Link>
                  <span className="tabular-nums">{q ? usd(q.mc) : "…"}</span>
                  {q ? <Pct v={q.change24h} className="w-16 text-right" /> : <span className="w-16" />}
                  <button onClick={() => toggleWatch(t)} aria-label="Remove from watchlist" className="text-warn"><Star className="size-4 fill-current" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <StrategiesList />

      <SecurityPanel />

      <section className="rounded-lg border border-line bg-panel overflow-hidden">
        <h2 className="px-4 h-11 flex items-center font-semibold border-b border-line">Trade history</h2>
        {fills.length === 0 ? (
          <p className="p-6 text-center text-muted">No trades yet.</p>
        ) : (
          <ul className="tabular-nums">
            {fills.slice(0, 30).map((f) => (
              <li key={f.hash} className="flex items-center gap-3 px-4 py-2 border-b border-line last:border-0 text-[13px]">
                <span className={`w-10 font-medium ${f.side === "buy" ? "text-up" : "text-down"}`}>{f.side === "buy" ? "Buy" : "Sell"}</span>
                <span className="flex-1 font-semibold">{f.symbol}</span>
                <span className="text-muted">{num(f.amount)}</span>
                <span className="w-24 text-right">{usd(f.usd)}</span>
                <a href={`${EXPLORER}/tx/${f.hash}`} target="_blank" rel="noreferrer" className="w-24 inline-flex items-center justify-end gap-1 text-faint text-[11px] hover:text-fg">
                  {new Date(f.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
