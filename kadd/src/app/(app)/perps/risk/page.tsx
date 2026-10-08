import Link from "next/link";
import { perpRisk } from "@/lib/perpl";
import { short } from "@/lib/mock";
import { PageHeader, card } from "@/components/ui";
import { AreaChart } from "@/components/charts";
import WalletAvatar from "@/components/WalletAvatar";
import AutoRefresh from "@/components/AutoRefresh";
import LiqMap from "@/components/LiqMap";

export const revalidate = 60;
export const metadata = { title: "Perps risk · Kadd", description: "Where Perpl positions get liquidated, who is closest, who just got liquidated, and how the protocol is doing." };

const compact = (n: number) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : n.toFixed(0));
const px = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 5 });
const int = (n: number) => n.toLocaleString("en-US");
const ago = (ts: number) => {
  const s = Date.now() / 1000 - ts;
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};

export default async function PerpsRiskPage() {
  const r = await perpRisk().catch(() => null);
  if (!r) {
    return (
      <div className="p-3 md:p-5">
        <PageHeader title="Perps risk" />
        <p className={`${card} p-6 text-[13px] text-muted`}>Couldn’t read Perpl right now. This page retries every minute.</p>
      </div>
    );
  }
  const d = r.daily ?? [];
  const series = (f: (x: (typeof d)[number]) => number) => d.map((x) => ({ t: x.day * 86400, v: f(x) }));
  let net = 0;
  const inflow = d.map((x) => ({ t: x.day * 86400, v: (net += x.depositedUsd - x.withdrawnUsd) }));
  const last7 = d.slice(-7);
  const sum = (xs: typeof d, f: (x: (typeof d)[number]) => number) => xs.reduce((s, x) => s + f(x), 0);

  const cards: [string, string, string][] = [
    ["Collateral (TVL)", compact(r.tvl), "AUSD held by the Perpl Exchange"],
    ["Open interest", compact(r.openInterest), "per side"],
    ["24h volume", compact(r.volume24h), `${r.markets.length} markets`],
    ["Near liquidation", int(r.near.count), `positions within 5% · ${compact(r.near.notional)}`],
    ...(r.volume.length
      ? ([
          ["7d volume", compact(r.volume.slice(-7).reduce((s, x) => s + x.usd, 0)), `${int(r.volume.slice(-7).reduce((s, x) => s + x.trades, 0))} trades`],
        ] as [string, string, string][])
      : []),
    ...(d.length
      ? ([
          ["7d new accounts", int(sum(last7, (x) => x.newAccounts)), "first deposits"],
          ["7d net inflow", compact(sum(last7, (x) => x.depositedUsd - x.withdrawnUsd)), "deposits − withdrawals"],
          ["7d liquidations", int(sum(last7, (x) => x.liquidations)), compact(sum(last7, (x) => x.liquidatedUsd))],
        ] as [string, string, string][])
      : []),
  ];

  return (
    <div className="p-3 md:p-5 flex flex-col gap-4">
      <AutoRefresh seconds={60} />
      <PageHeader title="Perps risk" desc="Perpl on Monad mainnet, read from its contract every minute: where positions get liquidated, who is closest, and how the protocol is doing.">
        <Link href="/leaderboard" className="text-[12px] font-medium text-muted hover:text-fg underline-offset-4 hover:underline">Perps traders →</Link>
        <Link href="/perps" className="text-[12px] font-medium text-muted hover:text-fg underline-offset-4 hover:underline">Trade perps →</Link>
      </PageHeader>

      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {cards.map(([k, v, note]) => (
          <article key={k} className={`${card} p-4 gap-1`}>
            <div className="text-[12px] text-muted">{k}</div>
            <div className="text-[20px] font-semibold tabular-nums tracking-[-0.01em]">{v}</div>
            <div className="text-[11px] text-faint">{note}</div>
          </article>
        ))}
      </section>

      <section className={`${card} p-4 gap-3`}>
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-[14px] font-semibold">Liquidation map</h2>
          <span className="text-[12px] text-muted">open positions by how far the price must move to liquidate them</span>
        </div>
        <LiqMap markets={r.markets.map((m) => ({ id: m.id, name: m.name, mark: m.mark, liqMap: m.liqMap }))} />
      </section>

      <section className={`${card} overflow-hidden`}>
        <h2 className="px-4 h-11 flex items-center gap-2 border-b border-line text-[13px] font-semibold">
          Closest to liquidation <span className="text-faint font-normal">within 10%</span>
        </h2>
        {!r.atRisk.length ? (
          <p className="px-4 py-5 text-[13px] text-muted">No open position is within 10% of its liquidation price.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tabular-nums">
              <thead className="text-[11px] text-muted">
                <tr className="h-9 border-b border-line">
                  <th className="text-left font-medium pl-4">Trader</th>
                  <th className="text-left font-medium px-3">Position</th>
                  <th className="text-right font-medium px-3">Size</th>
                  <th className="text-right font-medium px-3 hidden sm:table-cell">Mark → liquidation</th>
                  <th className="text-right font-medium pr-4">Away</th>
                </tr>
              </thead>
              <tbody>
                {r.atRisk.map((p) => (
                  <tr key={`${p.account}-${p.marketId}`} className="relative h-11 border-b border-line last:border-0 hover:bg-hover">
                    <td className="pl-4">
                      <span className="flex items-center gap-2">
                        <WalletAvatar address={p.address} size={22} />
                        <Link href={`/wallet/${p.address}#perps`} className="font-mono hover:underline after:absolute after:inset-0">{short(p.address)}</Link>
                      </span>
                    </td>
                    <td className="px-3"><span className={p.side === "long" ? "text-up" : "text-down"}>{p.side === "long" ? "Long" : "Short"}</span> {p.market} · {p.leverage.toFixed(1)}×</td>
                    <td className="px-3 text-right">{compact(p.notional)}</td>
                    <td className="px-3 text-right hidden sm:table-cell">{px(p.mark)} → {px(p.liquidation)}</td>
                    <td className={`pr-4 text-right font-semibold ${p.distance < 0.02 ? "text-down" : p.distance < 0.05 ? "text-warn" : ""}`}>{(p.distance * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {r.liquidations && r.liquidations.length > 0 && (
        <section className={`${card} overflow-hidden`}>
          <h2 className="px-4 h-11 flex items-center gap-2 border-b border-line text-[13px] font-semibold">Latest liquidations</h2>
          <ul className="text-[13px] tabular-nums">
            {r.liquidations.map((l, i) => (
              <li key={i} className="relative px-4 h-10 flex items-center gap-3 border-b border-line last:border-0 hover:bg-hover">
                <span className="w-16 text-[12px] text-faint">{ago(l.timestamp)}</span>
                {l.address ? (
                  <Link href={`/wallet/${l.address}#perps`} className="font-mono hover:underline after:absolute after:inset-0">{short(l.address)}</Link>
                ) : (
                  <span className="font-mono text-faint">unknown</span>
                )}
                <span className="flex-1"><span className={l.side === "long" ? "text-up" : "text-down"}>{l.side === "long" ? "Long" : "Short"}</span> {l.symbol}</span>
                <span className="hidden sm:inline text-muted">{compact(l.notionalUsd)} at {px(l.price)}</span>
                <span className={`w-20 text-right font-semibold ${l.pnlUsd >= 0 ? "text-up" : "text-down"}`}>{l.pnlUsd >= 0 ? "+" : "-"}${Math.abs(l.pnlUsd).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        {([
          ...(r.volume.length
            ? ([
                ["Volume per day", r.volume.map((x) => ({ t: x.day * 86400, v: x.usd })), "usd"],
                ["Trades per day", r.volume.map((x) => ({ t: x.day * 86400, v: x.trades })), undefined],
              ] as const)
            : []),
          ...(d.length
            ? ([
                ["Net deposits, cumulative (30d)", inflow, "pnl"],
                ["Liquidated per day", series((x) => x.liquidatedUsd), "usd"],
                ["New accounts per day", series((x) => x.newAccounts), undefined],
                ["Liquidations per day", series((x) => x.liquidations), undefined],
              ] as const)
            : []),
        ] as readonly (readonly [string, { t: number; v: number }[], "usd" | "pnl" | undefined])[]).map(([title, data, kind]) => (
          <article key={title} className={`${card} p-4 gap-2`}>
            <h3 className="text-[13px] font-semibold">{title}</h3>
            <AreaChart data={[...data]} height={140} kind={kind} />
          </article>
        ))}
        {!d.length && (
          <p className={`${card} p-4 text-[13px] text-muted md:col-span-2`}>
            Deposits, withdrawals and liquidations per day come from Kadd&apos;s Envio indexer and show here when it&apos;s reachable.
          </p>
        )}
      </section>
    </div>
  );
}
