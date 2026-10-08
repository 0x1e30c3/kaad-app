import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { WalletRisk } from "@/lib/perpl";
import { Panel, PanelEmpty } from "./ui";
import { AreaChart } from "./charts";

const px = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 5 });
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;
const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
const hold = (s: number) => (s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${(s / 3600).toFixed(1)}h` : `${(s / 86400).toFixed(1)}d`);
const ago = (ts: number) => {
  const s = Date.now() / 1000 - ts;
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};
const awayClass = (d: number) => (d < 0.02 ? "text-down font-semibold" : d < 0.05 ? "text-warn font-semibold" : "");

function Stat({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg bg-raised/60 px-3 py-2">
      <div className="text-[11px] text-muted">{k}</div>
      <div className={`text-[15px] font-semibold tabular-nums ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}>{v}</div>
    </div>
  );
}

/** A wallet's Perpl risk profile: margin, distance to liquidation, performance, and recent closes. */
export default function PerpsProfile({ address, risk }: { address: string; risk: WalletRisk }) {
  const p = risk.perf;
  return (
    <section id="perps" className="scroll-mt-4">
      <Panel
        title="Perps on Perpl"
        count={risk.open.length || undefined}
        actions={
          <>
            <Link href={`/perps/compare?w=${address}`} className="text-[12px] text-muted hover:text-fg">Compare</Link>
            <a href="https://app.perpl.xyz" target="_blank" rel="noreferrer" className="text-[12px] text-muted hover:text-fg inline-flex items-center gap-0.5">Perpl <ArrowUpRight className="size-3" /></a>
          </>
        }
      >
        <div className="p-4 grid gap-2 grid-cols-2 sm:grid-cols-4 border-b border-line">
          <Stat k="Equity" v={money(risk.equity)} />
          <Stat k="Margin in use" v={`${risk.marginUse.toFixed(0)}%`} tone={risk.marginUse > 80 ? "down" : undefined} />
          <Stat k="Free AUSD" v={money(risk.free)} />
          <Stat k="Open PnL" v={signed(risk.open.reduce((s, x) => s + x.pnl, 0))} tone={risk.open.reduce((s, x) => s + x.pnl, 0) >= 0 ? "up" : "down"} />
          {p && (
            <>
              <Stat k="Realized (all time)" v={signed(p.realized)} tone={p.realized >= 0 ? "up" : "down"} />
              <Stat k="Win rate" v={p.winRate === null ? "–" : `${Math.round(p.winRate)}% · ${p.trades}`} />
              <Stat k="Profit factor" v={p.profitFactor === null ? "–" : p.profitFactor === Infinity ? "∞" : p.profitFactor.toFixed(2)} />
              <Stat k="Max drawdown" v={money(p.maxDrawdown)} tone={p.maxDrawdown > 0 ? "down" : undefined} />
              <Stat k="Streaks" v={`${p.bestStreak}W · ${p.worstStreak}L`} />
              <Stat k="Avg hold" v={p.avgHoldSec === null ? "–" : hold(p.avgHoldSec)} />
              <Stat k="Best market" v={p.best ? `${p.best.symbol} ${signed(p.best.pnl)}` : "–"} />
              <Stat k="Worst market" v={p.worst ? `${p.worst.symbol} ${signed(p.worst.pnl)}` : "–"} />
            </>
          )}
        </div>

        {risk.open.length === 0 ? (
          <PanelEmpty>No open perps positions right now.</PanelEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tabular-nums">
              <thead className="text-[11px] text-muted">
                <tr className="h-8 border-b border-line">
                  <th className="text-left font-medium pl-4">Market</th>
                  <th className="text-right font-medium px-3">Size</th>
                  <th className="text-right font-medium px-3 hidden sm:table-cell">Entry → mark</th>
                  <th className="text-right font-medium px-3">Lev.</th>
                  <th className="text-right font-medium px-3 hidden sm:table-cell">Liq. ≈</th>
                  <th className="text-right font-medium px-3" title="How far the price can move against the position before it's liquidated">Away</th>
                  <th className="text-right font-medium px-3">PnL</th>
                  <th className="pr-4"><span className="sr-only">Trade</span></th>
                </tr>
              </thead>
              <tbody>
                {risk.open.map((x) => (
                  <tr key={x.marketId} className="h-10 border-b border-line last:border-0">
                    <td className="pl-4"><span className={`font-semibold ${x.side === "long" ? "text-up" : "text-down"}`}>{x.side === "long" ? "Long" : "Short"}</span> {x.market}</td>
                    <td className="px-3 text-right">{money(x.notional)}</td>
                    <td className="px-3 text-right hidden sm:table-cell">{px(x.entry)} → {px(x.mark)}</td>
                    <td className="px-3 text-right">{x.leverage.toFixed(1)}×</td>
                    <td className="px-3 text-right hidden sm:table-cell">{x.liquidation ? px(x.liquidation) : "–"}</td>
                    <td className={`px-3 text-right ${awayClass(x.distance)}`}>{Number.isFinite(x.distance) ? `${(x.distance * 100).toFixed(1)}%` : "–"}</td>
                    <td className={`px-3 text-right font-semibold ${x.pnl >= 0 ? "text-up" : "text-down"}`}>{signed(x.pnl)}</td>
                    <td className="pr-4 text-right">
                      <Link href={`/perps?market=${x.market}&side=${x.side}&lev=${Math.max(1, Math.min(10, Math.round(x.leverage)))}`} className="h-7 px-2 inline-flex items-center rounded-md border border-line-strong text-[12px] font-semibold hover:bg-hover whitespace-nowrap">
                        Trade like this
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {p && p.curve.length > 1 && (
          <div className="px-4 pt-4 border-t border-line">
            <div className="text-[12px] text-muted">Cumulative realized PnL</div>
            <AreaChart data={p.curve} height={140} kind="pnl" color={p.realized >= 0 ? "var(--up)" : "var(--down)"} />
          </div>
        )}

        {risk.history.length > 0 && (
          <details className="border-t border-line">
            <summary className="px-4 h-10 flex items-center text-[13px] font-medium cursor-pointer hover:bg-hover">Recent closes ({risk.history.length})</summary>
            <ul className="text-[13px] tabular-nums">
              {risk.history.slice(0, 30).map((c, i) => (
                <li key={i} className="px-4 h-9 flex items-center gap-3 border-t border-line">
                  <span className="w-16 text-faint text-[12px]">{ago(c.timestamp)}</span>
                  <span className="flex-1"><span className={c.side === "long" ? "text-up" : "text-down"}>{c.side === "long" ? "Long" : "Short"}</span> {c.symbol} <span className="text-faint">{c.kind === "close" ? "" : c.kind}</span></span>
                  <span className="text-faint hidden sm:inline">{c.holdSec ? `held ${hold(c.holdSec)}` : ""}</span>
                  <span className={`w-20 text-right font-semibold ${c.pnlUsd >= 0 ? "text-up" : "text-down"}`}>{signed(c.pnlUsd)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {!p && <p className="px-4 py-3 border-t border-line text-[11px] text-faint">Win rate, drawdown and trade history appear once Kadd&apos;s indexer has synced Perpl&apos;s history.</p>}
      </Panel>
    </section>
  );
}
