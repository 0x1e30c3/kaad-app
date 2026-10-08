"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { PerpBoard, PerpPosition, PerpRow } from "@/lib/perpl";
import type { BotView } from "@/lib/perplBot";
import { short } from "@/lib/mock";
import { card } from "./ui";
import WalletAvatar from "./WalletAvatar";

type SortKey = "total" | "realized" | "unrealized" | "win" | "notional" | "leverage";
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;
const compact = (n: number) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : n.toFixed(0));
const winOf = (r: PerpRow) => (r.closes ? (r.wins / r.closes) * 100 : -1);
const value: Record<SortKey, (r: PerpRow) => number> = {
  total: (r) => (r.realized ?? 0) + r.unrealized,
  realized: (r) => r.realized ?? 0,
  unrealized: (r) => r.unrealized,
  win: winOf,
  notional: (r) => r.notional,
  leverage: (r) => r.leverage,
};

export function PositionChip({ p }: { p: PerpPosition }) {
  return (
    <span className={`h-5 px-1.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 tabular-nums ${p.side === "long" ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>
      {p.market} {p.side === "long" ? "L" : "S"} {p.leverage.toFixed(p.leverage < 10 ? 1 : 0)}×
    </span>
  );
}

function Book({ title, positions, href }: { title: React.ReactNode; positions: PerpPosition[]; href?: string }) {
  return (
    <div className="flex-1 min-w-[220px] rounded-lg border border-line p-3 flex flex-col gap-2">
      <div className="text-[12px] text-muted">{href ? <a href={href} target="_blank" rel="noreferrer" className="hover:text-fg">{title}</a> : title}</div>
      {positions.length ? (
        <ul className="flex flex-col gap-1 text-[13px] tabular-nums">
          {positions.map((p) => (
            <li key={p.marketId} className="flex items-center gap-2">
              <PositionChip p={p} />
              <span className="ml-auto">{compact(p.notional)}</span>
              <span className={`w-16 text-right ${p.pnl >= 0 ? "text-up" : "text-down"}`}>{signed(p.pnl)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-muted">Flat</span>
      )}
    </div>
  );
}

/** Kadd's copy bot on Perpl testnet next to the mainnet trader it mirrors. */
function BotCard({ bot }: { bot: BotView }) {
  return (
    <section className={`${card} p-4 gap-3`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-[14px] font-semibold">Kadd copy bot</h2>
        <span className="text-[12px] text-muted">
          mirrors <Link href={`/wallet/${bot.leader}#perps`} className="font-mono hover:text-fg underline-offset-2 hover:underline">{short(bot.leader)}</Link> on Perpl testnet with ${bot.rules.budget} and at most {bot.rules.maxLeverage}× leverage, catching up every minute. Its API key can trade but never withdraw.
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        <Book title="Leader · Monad mainnet" positions={bot.leaderBook} />
        <Book title={bot.bot ? `Bot ${short(bot.bot)} · testnet ↗` : "Bot · testnet"} positions={bot.botBook} href={bot.bot ? `https://testnet.monadexplorer.com/address/${bot.bot}` : undefined} />
      </div>
    </section>
  );
}

/** Perpl perps traders: what they made over 30 days and what they hold right now, all read from Monad mainnet. */
export default function PerpsBoard({ board, bot }: { board: PerpBoard | null; bot?: BotView | null }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "total", desc: true });
  if (!board) return <section className={`${card} px-5 py-10 text-center text-[13px] text-muted`}>Couldn’t read Perpl right now. This page retries every minute.</section>;
  const rows = [...board.rows].sort((a, b) => (value[sort.key](b) - value[sort.key](a)) * (sort.desc ? 1 : -1));
  const th = (key: SortKey, label: string, className = "") => {
    const on = sort.key === key;
    return (
      <th className={`text-right font-medium px-3 ${className}`} aria-sort={on ? (sort.desc ? "descending" : "ascending") : "none"}>
        <button onClick={() => setSort({ key, desc: on ? !sort.desc : true })} className={`inline-flex items-center gap-0.5 hover:text-fg ${on ? "text-fg" : ""}`}>
          {label}
          {on ? sort.desc ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" /> : <ChevronDown className="size-3 opacity-0" />}
        </button>
      </th>
    );
  };

  return (
    <>
      {bot && <BotCard bot={bot} />}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          ["Open positions", board.positions.toLocaleString("en-US"), `${board.markets} markets`],
          ["Traders holding", board.holders.toLocaleString("en-US"), "right now"],
          ["Open interest", compact(board.openInterest), `per side · ${compact(board.volume24h)} traded 24h`],
          ["Ranked by", board.realized ? "30d PnL" : "Open PnL", board.realized ? "realized + open" : "realized history syncing"],
        ].map(([k, v, note]) => (
          <article key={k} className={`${card} p-4 gap-1`}>
            <div className="text-[12px] text-muted">{k}</div>
            <div className="text-[20px] font-semibold tabular-nums tracking-[-0.01em]">{v}</div>
            <div className="text-[11px] text-faint">{note}</div>
          </article>
        ))}
      </section>

      {board.marketStats.length > 0 && (
        <section className={`${card} overflow-hidden`}>
          <h2 className="px-4 h-11 flex items-center border-b border-line text-[13px] font-semibold">Markets</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tabular-nums">
              <thead className="text-[11px] text-muted">
                <tr className="h-9 border-b border-line">
                  <th className="text-left font-medium pl-4">Market</th>
                  <th className="text-right font-medium px-3">Price</th>
                  <th className="text-right font-medium px-3 hidden sm:table-cell">24h volume</th>
                  <th className="text-right font-medium px-3">Open interest</th>
                  <th className="text-left font-medium px-3 hidden md:table-cell">Long / short traders</th>
                  <th className="text-right font-medium px-3 hidden md:table-cell">Avg lev.</th>
                  <th className="text-right font-medium px-3 hidden lg:table-cell" title="Latest funding rate, % per hour; positive means longs pay shorts">Funding /h</th>
                  <th className="text-right font-medium pr-4" title="Open positions within 5% of their liquidation price">Near liq.</th>
                </tr>
              </thead>
              <tbody>
                {board.marketStats.map((m) => (
                  <tr key={m.id} className="h-11 border-b border-line last:border-0">
                    <td className="pl-4 font-semibold">{m.name}</td>
                    <td className="px-3 text-right">
                      {m.mark.toLocaleString("en-US", { maximumSignificantDigits: 6 })} <span className={`text-[11px] ${m.change24h >= 0 ? "text-up" : "text-down"}`}>{m.change24h >= 0 ? "+" : ""}{m.change24h.toFixed(1)}%</span>
                    </td>
                    <td className="px-3 text-right hidden sm:table-cell">{compact(m.volume24h)}</td>
                    <td className="px-3 text-right">{compact(m.openInterest)}</td>
                    <td className="px-3 hidden md:table-cell">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 rounded-full bg-down/40 overflow-hidden"><span className="block h-full bg-up" style={{ width: `${m.longShare}%` }} /></span>
                        <span className="text-[11px] text-muted">{Math.round(m.longShare)}% long · {m.positions}</span>
                      </span>
                    </td>
                    <td className="px-3 text-right hidden md:table-cell">{m.avgLeverage ? `${m.avgLeverage.toFixed(1)}×` : "–"}</td>
                    <td className="px-3 text-right hidden lg:table-cell">{m.fundingHourly === null ? "–" : `${m.fundingHourly.toFixed(4)}%`}</td>
                    <td className={`pr-4 text-right ${m.atRisk ? "text-warn font-semibold" : "text-muted"}`}>{m.atRisk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] text-muted">
              <tr className="h-9 border-b border-line">
                <th className="text-left font-medium pl-4 pr-2 w-10">#</th>
                <th className="text-left font-medium px-2">Trader</th>
                {th("total", board.realized ? "30d PnL" : "Open PnL")}
                {board.realized && th("realized", "Realized", "hidden md:table-cell")}
                {board.realized && th("unrealized", "Open PnL", "hidden sm:table-cell")}
                {board.realized && th("win", "Win rate", "hidden md:table-cell")}
                <th className="text-left font-medium px-3 hidden lg:table-cell">Holding now</th>
                {th("notional", "Size", "hidden sm:table-cell")}
                {th("leverage", "Lev.", "pr-4")}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r, i) => {
                const total = value.total(r);
                return (
                  <tr key={r.address} className="relative h-12 border-b border-line last:border-0 hover:bg-hover">
                    <td className="pl-4 pr-2 text-faint tabular-nums">{i + 1}</td>
                    <td className="px-2">
                      <span className="flex items-center gap-2">
                        <WalletAvatar address={r.address} size={24} />
                        <Link href={`/wallet/${r.address}#perps`} className="font-mono font-semibold hover:underline after:absolute after:inset-0">{short(r.address)}</Link>
                        {r.liquidations > 0 && <span className="text-[11px] text-down" title="Liquidations in 30 days">{r.liquidations} liq.</span>}
                      </span>
                    </td>
                    <td className={`px-3 text-right font-semibold tabular-nums ${total >= 0 ? "text-up" : "text-down"}`}>{signed(total)}</td>
                    {board.realized && <td className={`px-3 text-right tabular-nums hidden md:table-cell ${(r.realized ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed(r.realized ?? 0)}</td>}
                    {board.realized && <td className={`px-3 text-right tabular-nums hidden sm:table-cell ${r.unrealized >= 0 ? "text-up" : "text-down"}`}>{r.open.length ? signed(r.unrealized) : "–"}</td>}
                    {board.realized && <td className="px-3 text-right tabular-nums hidden md:table-cell">{r.closes ? `${Math.round(winOf(r))}% · ${r.closes}` : "–"}</td>}
                    <td className="px-3 hidden lg:table-cell">
                      <span className="flex flex-wrap gap-1">{r.open.slice(0, 3).map((p) => <PositionChip key={p.marketId} p={p} />)}{r.open.length > 3 && <span className="text-[11px] text-faint">+{r.open.length - 3}</span>}</span>
                    </td>
                    <td className="px-3 text-right tabular-nums hidden sm:table-cell">{r.notional ? compact(r.notional) : "–"}</td>
                    <td className="pr-4 pl-3 text-right tabular-nums">{r.leverage ? `${r.leverage.toFixed(1)}×` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 border-t border-line text-[11px] text-faint">
          Perpetual futures on <a href="https://app.perpl.xyz" target="_blank" rel="noreferrer" className="underline">Perpl</a>, Monad mainnet. Open positions are read from the Perpl contract every minute; realized PnL (price PnL plus funding, before fees) comes from Kadd&apos;s Envio indexer.
        </p>
      </section>
    </>
  );
}
