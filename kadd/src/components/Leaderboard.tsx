"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronUp, Flame, Trophy, Users, Zap } from "lucide-react";
import type { Board, BoardRow, Period } from "@/lib/leaderboard";
import type { MainnetBoard as Mainnet } from "@/lib/wallets";
import MainnetBoard from "./MainnetBoard";
import SmartMoneyBoard from "./SmartMoneyBoard";
import PerpsBoard from "./PerpsBoard";
import type { PerpBoard } from "@/lib/perpl";
import type { BotView } from "@/lib/perplBot";
import type { SmartMoney } from "@/lib/nansen";
import { short, usd } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { Monogram, card, hueOf } from "./ui";
import WalletAvatar from "./WalletAvatar";
import { AreaChart, agoLabel } from "./charts";

const TABS = [["mainnet", "Monad mainnet"], ["smart", "Smart Money"], ["perps", "Perps · Perpl"], ["traders", "Kadd traders"], ["clubs", "Kadd clubs"]] as const;
const PERIODS: [Period, string][] = [["1", "24h"], ["7", "7d"], ["30", "30d"]];
const DAYS = { "1": 1, "7": 7, "30": 30 } as const;
type SortKey = "pnl" | "roi" | "win" | "volume" | "trades";

const money = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;

const Change = ({ v }: { v: number }) => (
  <span className={`inline-flex items-center gap-0.5 font-medium ${v >= 0 ? "text-up" : "text-down"}`}>
    <span className="text-[9px]">{v >= 0 ? "▲" : "▼"}</span>
    {Math.abs(v).toFixed(1)}%
  </span>
);

const Trend = ({ series, days, height = 32 }: { series: number[]; days: number; height?: number }) => (
  <div className="relative z-10">
    <AreaChart
      data={series.map((v, i) => ({ t: i, v }))}
      height={height}
      axes={false}
      fill={height > 40}
      kind="pnl"
      label={agoLabel(days)}
      color={series[series.length - 1] >= 0 ? "var(--up)" : "var(--down)"}
    />
  </div>
);

export default function Leaderboard({ board, mainnet, smart, perps, bot, copiers }: { board: Board; mainnet: Mainnet; smart: SmartMoney; perps: PerpBoard | null; bot: BotView | null; copiers: Record<string, number> }) {
  const { user } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("mainnet");
  const [period, setPeriod] = useState<Period>("7");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "pnl", desc: true });
  const me = user?.address.toLowerCase();
  const days = DAYS[period];

  // Rank is always by PnL (the server sorts that way); other columns only reorder rows, like CMC.
  const ranked = (tab === "mainnet" || tab === "smart" || tab === "perps" ? [] : board[tab][period]).map((r, i) => ({ ...r, rank: i + 1 }));
  const rows = [...ranked].sort((a, b) => ((b[sort.key] ?? -1) - (a[sort.key] ?? -1)) * (sort.desc ? 1 : -1));
  const nameOf = (r: BoardRow) => r.name ?? (r.address === me ? "You" : r.nns ?? short(r.address));
  const avatar = (r: BoardRow, size: number) =>
    r.name ? <Monogram name={r.name} hue={hueOf(r.address)} size={size} /> : <WalletAvatar address={r.address} src={r.avatar} size={size} />;
  const href = (r: BoardRow) => (r.name ? `/clubs/${r.address}` : `/wallet/${r.address}`);

  const best = (f: (r: BoardRow) => number) => [...ranked].sort((a, b) => f(b) - f(a))[0];
  const highlights: { icon: React.ReactNode; label: string; row: BoardRow; value: React.ReactNode }[] = !ranked.length
    ? []
    : tab === "traders"
      ? [
          { icon: <Trophy />, label: "Top PnL", row: ranked[0], value: <span className={ranked[0].pnl >= 0 ? "text-up" : "text-down"}>{money(ranked[0].pnl)}</span> },
          { icon: <Zap />, label: "Most active", row: best((r) => r.trades), value: `${best((r) => r.trades).trades} trades` },
          ...(ranked.some((r) => r.win !== null) ? [{ icon: <Flame />, label: "Best win rate", row: best((r) => r.win ?? -1), value: `${best((r) => r.win ?? -1).win}%` }] : []),
        ]
      : ranked.slice(0, 3).map((row, i) => ({ icon: i === 0 ? <Trophy /> : <Users />, label: `#${i + 1} by PnL`, row, value: <span className={row.pnl >= 0 ? "text-up" : "text-down"}>{money(row.pnl)}</span> }));

  const seg = (on: boolean) => `h-7 px-3 rounded-md text-[12px] font-medium ${on ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`;
  const th = (key: SortKey, children: string, className = "") => {
    const on = sort.key === key;
    return (
      <th key={key} className={`text-right font-medium px-3 ${className}`} aria-sort={on ? (sort.desc ? "descending" : "ascending") : "none"}>
        <button onClick={() => setSort({ key, desc: on ? !sort.desc : true })} className={`inline-flex items-center gap-0.5 hover:text-fg ${on ? "text-fg" : ""}`}>
          {children}
          {on ? sort.desc ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" /> : <ChevronDown className="size-3 opacity-0" />}
        </button>
      </th>
    );
  };
  const nameLink = (r: BoardRow, className: string) => (
    <Link href={href(r)} className={`${className} hover:underline after:absolute after:inset-0`}>{nameOf(r)}</Link>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Leaderboard" className="flex p-0.5 rounded-lg bg-raised">
          {TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={seg(tab === v)}>{l}</button>)}
        </div>
        <span className="text-[11px] text-muted hidden sm:inline">{tab === "mainnet" ? "Real wallets trading on Monad" : tab === "smart" ? "Nansen-labelled smart money" : tab === "perps" ? "Perpetual futures traders on Monad" : "Swaps on the Kadd testnet venue"}</span>
        {tab !== "mainnet" && tab !== "smart" && tab !== "perps" && (
          <div role="tablist" aria-label="Period" className="ml-auto flex p-0.5 rounded-lg bg-raised">
            {PERIODS.map(([v, l]) => <button key={v} role="tab" aria-selected={period === v} onClick={() => setPeriod(v)} className={seg(period === v)}>{l}</button>)}
          </div>
        )}
      </div>

      {tab === "mainnet" ? (
        <MainnetBoard board={mainnet} />
      ) : tab === "perps" ? (
        <PerpsBoard board={perps} bot={bot} />
      ) : tab === "smart" ? (
        <SmartMoneyBoard data={smart} active={mainnet.rows.filter((r) => r.smart !== null)} copiers={copiers} />
      ) : (
      <>

      {highlights.length > 0 && (
        <section className="-mx-3 px-3 md:mx-0 md:px-0 flex gap-3 overflow-x-auto snap-x md:grid md:grid-cols-3 md:overflow-visible">
          {highlights.map((h) => (
            <article key={h.label} className={`${card} p-4 gap-3 shrink-0 w-[85%] snap-start md:w-auto`}>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted [&>svg]:size-3.5">{h.icon}{h.label}</div>
              <div className="flex items-center gap-2.5">
                {avatar(h.row, 32)}
                <div className="min-w-0 flex-1">
                  {nameLink(h.row, "block truncate text-[14px] font-semibold")}
                  <div className="text-[11px] text-faint font-mono truncate">{h.row.name ? short(h.row.address) : `${h.row.trades} trades`}</div>
                </div>
                <div className="text-[18px] font-semibold tabular-nums tracking-[-0.01em]">{h.value}</div>
              </div>
              <Trend series={h.row.series} days={days} height={48} />
            </article>
          ))}
        </section>
      )}

      <section className={`${card} overflow-hidden`}>
        {!board.ready ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">The leaderboard needs event history; it appears once the Envio HyperRPC token is configured.</p>
        ) : board.failed ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">Couldn’t load trades from Monad testnet just now. This page retries every minute.</p>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 flex flex-col items-center text-center gap-2">
            <Trophy className="size-6 text-faint" />
            <div className="text-[15px] font-semibold">{tab === "traders" ? "No trades" : "No club trades"} in the last {PERIODS.find(([v]) => v === period)![1]}</div>
            <p className="max-w-sm text-[13px] text-muted">
              {tab === "traders" ? "Every swap on Kadd counts. Make one and you’re on the board." : "When a club captain trades, the club shows up here."}
            </p>
            <Link href={tab === "traders" ? "/trenches" : "/groups"} className="mt-2 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-fg text-bg text-[13px] font-semibold hover:opacity-90">
              {tab === "traders" ? "Open Trenches" : "Browse clubs"} <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tabular-nums whitespace-nowrap">
              <thead className="text-[11px] text-muted">
                <tr className="border-b border-line">
                  <th className="w-12 py-3 font-medium">#</th>
                  <th className="text-left font-medium px-3">{tab === "traders" ? "Trader" : "Club"}</th>
                  {th("pnl", "PnL")}
                  {th("roi", "ROI", "hidden sm:table-cell")}
                  {th("win", "Win rate", "hidden md:table-cell")}
                  {th("volume", "Volume", "hidden md:table-cell")}
                  {th("trades", "Trades", "hidden lg:table-cell")}
                  <th className="text-right font-medium px-4 hidden sm:table-cell">Trend</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.address} className={`relative border-b border-line last:border-0 hover:bg-hover ${r.address === me ? "bg-brand/5" : ""}`}>
                    <td className="py-3 text-center text-muted">{r.rank}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-2.5">
                        {avatar(r, 28)}
                        <div className="leading-tight">
                          {nameLink(r, "font-semibold")}
                          <div className="text-[11px] text-faint font-mono">{r.name || r.nns || r.address === me ? short(r.address) : "wallet"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 text-right">
                      <div className={`font-semibold ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{money(r.pnl)}</div>
                      <div className="sm:hidden text-[11px]"><Change v={r.roi} /></div>
                    </td>
                    <td className="px-3 text-right hidden sm:table-cell"><Change v={r.roi} /></td>
                    <td className="px-3 hidden md:table-cell">
                      {r.win === null ? (
                        <div className="text-right text-faint" title="Nothing sold yet">–</div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1 rounded-full bg-raised overflow-hidden"><div className="h-full rounded-full bg-fg/60" style={{ width: `${r.win}%` }} /></div>
                          <span className="w-9 text-right">{r.win}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 text-right hidden md:table-cell">{usd(r.volume)}</td>
                    <td className="px-3 text-right hidden lg:table-cell">{r.trades}</td>
                    <td className="px-4 hidden sm:table-cell"><div className="w-24 ml-auto"><Trend series={r.series} days={days} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="-mt-2 text-[11px] text-faint">
        PnL counts swaps on Kadd in the period, with tokens still held valued at today’s pool price. Win rate is the share of sells above the average buy price.
      </p>
      </>
      )}
    </>
  );
}
