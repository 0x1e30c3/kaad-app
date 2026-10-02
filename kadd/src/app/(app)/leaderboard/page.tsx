"use client";
import { useState } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { GROUPS, TRADERS, getTrader, short, usd } from "@/lib/mock";
import { PageHeader, TraderAvatar } from "@/components/ui";

const TABS = [["traders", "Trader"], ["groups", "Groups"]] as const;
const PERIODS = [["1", "24h"], ["7", "7d"], ["30", "30d"]] as const;

// ponytail: other periods are a scaled 7d PnL until real per-period data exists.
const SCALE = { "1": 0.2, "7": 1, "30": 3.1 } as const;
const money = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const Rank = ({ i }: { i: number }) =>
  i < 3 ? <Crown className={`size-4 mx-auto ${["text-warn", "text-muted", "text-[#b87333]"][i]}`} /> : <span className="tabular-nums text-muted">{i + 1}</span>;

export default function LeaderboardPage() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("traders");
  const [period, setPeriod] = useState<keyof typeof SCALE>("7");
  const k = SCALE[period];

  const traders = [...TRADERS].sort((a, b) => b.pnl7d - a.pnl7d);
  const groups = GROUPS.map((g) => {
    const m = g.members.map(getTrader).filter(Boolean);
    return { g, pnl: m.reduce((s, t) => s + t!.pnl7d, 0), volume: m.reduce((s, t) => s + t!.volume, 0) };
  }).sort((a, b) => b.pnl - a.pnl);

  const seg = (on: boolean) => `h-7 px-3 rounded-md text-[12px] font-medium ${on ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`;

  return (
    <div className="p-3 md:p-5 max-w-5xl mx-auto">
      <PageHeader title="Leaderboard" desc="Top traders and groups by PnL. Demo data until groups go onchain.">
        <Link href="/stats" className="h-8 px-3 grid place-items-center rounded-md border border-line text-[12px] font-medium text-muted hover:text-fg">Real network stats →</Link>
        <div className="flex p-0.5 rounded-lg bg-raised">
          {TABS.map(([v, l]) => <button key={v} onClick={() => setTab(v)} className={seg(tab === v)}>{l}</button>)}
        </div>
        <div className="flex p-0.5 rounded-lg bg-raised">
          {PERIODS.map(([v, l]) => <button key={v} onClick={() => setPeriod(v)} className={seg(period === v)}>{l}</button>)}
        </div>
      </PageHeader>

      <div className="rounded-lg border border-line bg-panel overflow-x-auto">
        <table className="w-full tabular-nums">
          <thead className="text-[11px] text-muted">
            <tr className="border-b border-line">
              <th className="w-12 py-2.5 font-medium">#</th>
              <th className="text-left font-medium px-3">{tab === "traders" ? "Trader" : "Group"}</th>
              <th className="text-right font-medium px-3">PnL</th>
              <th className="text-right font-medium px-3 hidden sm:table-cell">{tab === "traders" ? "Win rate" : "Members"}</th>
              <th className="text-right font-medium px-3 hidden sm:table-cell">Volume</th>
              {tab === "traders" && <th className="text-right font-medium px-3 hidden md:table-cell">Trades</th>}
            </tr>
          </thead>
          <tbody>
            {tab === "traders"
              ? traders.map((t, i) => (
                  <tr key={t.address} className="border-b border-line last:border-0 hover:bg-hover">
                    <td className="py-2.5 text-center"><Rank i={i} /></td>
                    <td className="px-3">
                      <div className="flex items-center gap-2.5">
                        <TraderAvatar name={t.name} hue={t.hue} />
                        <div>
                          <div className="font-medium">{t.name}</div>
                          <div className="font-mono text-[11px] text-faint">{short(t.address)}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-3 text-right font-semibold ${t.pnl7d >= 0 ? "text-up" : "text-down"}`}>{money(t.pnl7d * k)}</td>
                    <td className="px-3 text-right hidden sm:table-cell">{t.winRate}%</td>
                    <td className="px-3 text-right hidden sm:table-cell">{usd(t.volume * k)}</td>
                    <td className="px-3 text-right hidden md:table-cell">{Math.round(t.trades * k)}</td>
                  </tr>
                ))
              : groups.map(({ g, pnl, volume }, i) => (
                  <tr key={g.id} className="border-b border-line last:border-0 hover:bg-hover">
                    <td className="py-2.5 text-center"><Rank i={i} /></td>
                    <td className="px-3">
                      <Link href={`/groups/${g.id}`} className="flex items-center gap-2.5 hover:underline">
                        <span className="grid place-items-center size-7 rounded-md bg-raised font-semibold">{g.name[0]}</span>
                        <span className="font-medium">{g.name}</span>
                      </Link>
                    </td>
                    <td className={`px-3 text-right font-semibold ${pnl >= 0 ? "text-up" : "text-down"}`}>{money(pnl * k)}</td>
                    <td className="px-3 text-right hidden sm:table-cell">{g.members.length}</td>
                    <td className="px-3 text-right hidden sm:table-cell">{usd(volume * k)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
