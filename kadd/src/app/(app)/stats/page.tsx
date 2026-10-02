import Link from "next/link";
import { Activity, BarChart3, Droplets, Landmark, Repeat, Users, Wallet, Workflow } from "lucide-react";
import { getStats } from "@/lib/stats";
import { VENUE } from "@/lib/addresses";
import { EXPLORER } from "@/lib/venue";
import { PageHeader } from "@/components/ui";
import AutoRefresh from "@/components/AutoRefresh";

export const revalidate = 60;
export const metadata = { title: "Stats · Kadd" };

const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
const int = (n: number) => n.toLocaleString("en-US");

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Activity; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="p-4 rounded-lg border border-line bg-panel">
      <div className="flex items-center gap-1.5 text-[12px] text-muted"><Icon className="size-3.5" /> {label}</div>
      <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.02em]">{value}</div>
      {hint && <div className="text-[11px] text-faint">{hint}</div>}
    </div>
  );
}

export default async function StatsPage() {
  const s = await getStats();
  const a = s.activity;
  const pending = <span className="text-faint text-[18px]">needs indexer</span>;
  return (
    <div className="p-3 md:p-5 max-w-6xl mx-auto flex flex-col gap-6">
      <AutoRefresh seconds={60} />
      <PageHeader title="Network stats" desc="Live activity on Kadd, read straight from Monad testnet contracts.">
        <a href={`${EXPLORER}/address/${VENUE}`} target="_blank" rel="noreferrer" className="text-[12px] text-muted hover:text-fg underline-offset-4 hover:underline">Venue contract ↗</a>
      </PageHeader>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 -mt-2">
        <Kpi icon={Repeat} label="Trades" value={a ? int(a.trades) : pending} hint="Swaps on Kadd pools" />
        <Kpi icon={BarChart3} label="Volume" value={a ? money(a.volume) : pending} hint="In test USDC" />
        <Kpi icon={Users} label="Unique wallets" value={a ? int(a.traders) : pending} hint="Traders + club members" />
        <Kpi icon={Droplets} label="Faucet claims" value={int(s.faucetClaims)} hint="1,000 tUSDC each" />
        <Kpi icon={Landmark} label="Clubs" value={int(s.clubs)} hint={a ? `${int(a.deposits)} deposits` : undefined} />
        <Kpi icon={Wallet} label="tUSDC in clubs" value={money(s.clubTvl)} />
        <Kpi icon={Activity} label="Markets" value={int(s.pools.length)} hint={`${money(s.poolLiquidity)} liquidity`} />
        <Kpi icon={Workflow} label="Strategies" value={s.strategies === null ? <span className="text-faint text-[18px]">soon</span> : int(s.strategies)} hint="Limit, TP/SL, DCA" />
      </div>

      {!a && (
        <p className="-mt-3 text-[12px] text-muted">
          Trade, volume and wallet counts come from event history. Monad’s public RPC only serves 100 blocks of logs at a time, so these come from Envio HyperRPC once its token is configured.
        </p>
      )}

      <section className="rounded-lg border border-line bg-panel overflow-x-auto">
        <h2 className="px-4 h-11 flex items-center font-semibold border-b border-line">Markets</h2>
        {s.pools.length === 0 ? (
          <p className="p-8 text-center text-muted">No markets yet. The first trade on any token opens one.</p>
        ) : (
          <table className="w-full text-[13px] tabular-nums">
            <thead className="text-[11px] text-muted">
              <tr className="border-b border-line">
                <th className="text-left font-medium px-4 py-2">Token</th>
                <th className="text-right font-medium px-3">Pool price</th>
                <th className="text-right font-medium px-3">Liquidity</th>
                <th className="text-right font-medium px-3">Trades</th>
                <th className="text-right font-medium px-4">Volume</th>
              </tr>
            </thead>
            <tbody>
              {s.pools.map((p) => (
                <tr key={p.pool} className="border-b border-line last:border-0 hover:bg-hover">
                  <td className="px-4 py-2.5 font-semibold">
                    <Link href={`/token/${p.source.toLowerCase()}`} className="hover:underline">{p.symbol}</Link>
                  </td>
                  <td className="px-3 text-right">${p.price.toLocaleString("en-US", { maximumSignificantDigits: 4 })}</td>
                  <td className="px-3 text-right">{money(p.liquidity)}</td>
                  <td className="px-3 text-right">{p.trades === null ? "–" : int(p.trades)}</td>
                  <td className="px-4 text-right">{p.volume === null ? "–" : money(p.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
