"use client";
import Link from "next/link";
import { FlaskConical, Star, Wallet } from "lucide-react";
import { num, usd } from "@/lib/mock";
import { toggleWatch, trade, useStore } from "@/lib/store";
import { useQuotes } from "@/lib/useQuotes";
import { PageHeader, Pct, TokenIcon } from "@/components/ui";
import LoginGate from "@/components/LoginGate";

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
  const { user, balance, positions, fills, watchlist } = useStore();
  const quotes = useQuotes([...positions, ...watchlist].map((t) => t.address));

  if (!user)
    return (
      <div className="p-3 md:p-5 max-w-5xl mx-auto">
        <PageHeader title="Portfolio" />
        <LoginGate icon={Wallet} title="See your portfolio" desc="Sign in to see your balance, positions, PnL and trade history." />
      </div>
    );

  const rows = positions.map((p) => {
    const price = quotes[p.address]?.price;
    const value = price === undefined ? null : p.amount * price; // null until the live price arrives
    return { p, price, value, pnl: value === null ? null : value - p.cost };
  });
  const priced = rows.filter((r) => r.value !== null);
  const holdings = priced.reduce((s, r) => s + r.value!, 0);
  const cost = priced.reduce((s, r) => s + r.p.cost, 0);
  const pnl = holdings - cost;
  const loading = priced.length < rows.length;

  return (
    <div className="p-3 md:p-5 max-w-5xl mx-auto flex flex-col gap-6">
      <PageHeader title="Portfolio" desc="Your balance, open positions and trade history." />
      <p className="-mt-4 flex items-start gap-2 p-3 rounded-lg bg-warn/10 text-warn text-[12px]">
        <FlaskConical className="size-4 shrink-0" />
        Demo mode: positions are valued at live Monad mainnet prices, but balance and trades are simulated in this browser. Your onchain funds are in Clubs.
      </p>

      <div className="grid gap-3 sm:grid-cols-3 -mt-2">
        <Card label="Total value" value={loading ? "…" : usd(balance + holdings)} />
        <Card label="USDC balance (demo)" value={balance.toFixed(2)} />
        <Card
          label="Unrealized PnL"
          value={loading ? "…" : <span className={pnl >= 0 ? "text-up" : "text-down"}>{pnl >= 0 ? "+" : "-"}{usd(Math.abs(pnl))}</span>}
          sub={!loading && cost > 0 && <Pct v={(pnl / cost) * 100} />}
        />
      </div>

      <section className="rounded-lg border border-line bg-panel overflow-x-auto">
        <h2 className="px-4 h-11 flex items-center font-semibold border-b border-line">Positions <span className="ml-1.5 text-faint font-normal">{rows.length}</span></h2>
        {rows.length === 0 ? (
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
              {rows.map(({ p, price, value, pnl }) => (
                <tr key={p.address} className="border-b border-line last:border-0 hover:bg-hover">
                  <td className="px-4 py-2.5">
                    <Link href={`/token/${p.address}`} className="flex items-center gap-2.5">
                      <TokenIcon t={p} size={30} />
                      <div>
                        <div className="font-semibold">{p.symbol}</div>
                        <div className="text-[11px] text-muted">Cost {usd(p.cost)}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 text-right hidden sm:table-cell">{num(p.amount)}</td>
                  <td className="px-3 text-right">{value === null ? "…" : usd(value)}</td>
                  <td className={`px-3 text-right ${pnl === null ? "" : pnl >= 0 ? "text-up" : "text-down"}`}>
                    {pnl === null ? "…" : (
                      <>
                        <div>{pnl >= 0 ? "+" : "-"}{usd(Math.abs(pnl))}</div>
                        <Pct v={(pnl / p.cost) * 100} className="text-[11px]" />
                      </>
                    )}
                  </td>
                  <td className="pr-4 text-right">
                    <button
                      onClick={() => price && trade({ ...p, price }, "sell", 100)}
                      disabled={!price}
                      className="h-7 px-2.5 rounded-md border border-line-strong text-[12px] font-semibold whitespace-nowrap hover:bg-hover disabled:opacity-40"
                    >
                      Sell all
                    </button>
                  </td>
                </tr>
              ))}
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

      <section className="rounded-lg border border-line bg-panel overflow-hidden">
        <h2 className="px-4 h-11 flex items-center font-semibold border-b border-line">Trade history</h2>
        {fills.length === 0 ? (
          <p className="p-6 text-center text-muted">No trades yet.</p>
        ) : (
          <ul className="tabular-nums">
            {fills.slice(0, 30).map((f, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2 border-b border-line last:border-0 text-[13px]">
                <span className={`w-10 font-medium ${f.side === "buy" ? "text-up" : "text-down"}`}>{f.side === "buy" ? "Buy" : "Sell"}</span>
                <span className="flex-1 font-semibold">{f.symbol}</span>
                <span className="text-muted">{num(f.amount)}</span>
                <span className="w-24 text-right">{usd(f.usd)}</span>
                <span className="w-20 text-right text-faint text-[11px]">{new Date(f.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
