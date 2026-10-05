"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { groupFeed, num, short, usd } from "@/lib/mock";
import { dexName, type TokenDetail, type TokenTrade } from "@/lib/market";
import { allGroups, useStore } from "@/lib/store";

const SCAN = "https://monadscan.com";
const ago = (sec: number) => (sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m` : `${Math.floor(sec / 3600)}h`);

export default function TokenTabs({ t, trades }: { t: Omit<TokenDetail, "candles" | "trades">; trades: TokenTrade[] | null }) {
  const tabs = [
    ["trades", "Trades"],
    ["info", "Info"],
    ["group", "Group activity"],
  ] as const;
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("trades");
  const s = useStore();
  const myGroups = allGroups(s).filter((g) => s.joined.includes(g.id));
  // ponytail: group feeds are demo data until groups have a backend; pinned to this token to show the shape.
  const groupTrades = myGroups.flatMap((g) => groupFeed(g.members, 4).map((x) => ({ ...x, group: g.name })));

  return (
    <div className="flex flex-col min-h-0">
      <div role="tablist" className="flex gap-1 px-3 h-10 items-end border-b border-line">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`h-10 px-2 -mb-px border-b-2 text-[13px] font-medium ${tab === k ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "trades" &&
        (trades === null ? (
          <p className="py-16 px-6 text-center text-muted">Trades are temporarily unavailable (data provider busy). They refresh on their own in a moment.</p>
        ) : trades.length ? (
          <table className="w-full text-[12px] tabular-nums">
            <thead className="text-[11px] text-muted">
              <tr className="border-b border-line">
                <th className="text-left font-medium px-3 py-2">Age</th>
                <th className="text-left font-medium px-3">Type</th>
                <th className="text-right font-medium px-3 hidden sm:table-cell">MC</th>
                <th className="text-right font-medium px-3">Amount</th>
                <th className="text-right font-medium px-3">Value</th>
                <th className="text-right font-medium px-3">Trader</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((x) => {
                const c = x.side === "buy" ? "text-up" : "text-down";
                return (
                  <tr key={x.tx + x.trader + x.amount} className="border-b border-line hover:bg-hover">
                    <td className="px-3 py-1.5 text-muted">
                      <a href={`${SCAN}/tx/${x.tx}`} target="_blank" rel="noreferrer" className="hover:text-fg hover:underline">{ago(x.ageSec)}</a>
                    </td>
                    <td className={`px-3 font-medium ${c}`}>{x.side === "buy" ? "Buy" : "Sell"}</td>
                    <td className="px-3 text-right hidden sm:table-cell">{usd(x.mc)}</td>
                    <td className="px-3 text-right">{num(x.amount)}</td>
                    <td className={`px-3 text-right ${c}`}>{usd(x.usd)}</td>
                    <td className="px-3 text-right">
                      <Link href={`/wallet/${x.trader.toLowerCase()}`} className="font-mono text-[11px] text-muted hover:text-fg hover:underline">{short(x.trader)}</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="py-16 text-center text-muted">No recent trades.</p>
        ))}

      {tab === "info" && (
        <div className="flex flex-col gap-4 p-3 text-[13px]">
          {t.description && <p className="max-w-[70ch] whitespace-pre-line leading-relaxed text-muted">{t.description}</p>}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Holders", t.holders == null ? "–" : num(t.holders)],
              ["GeckoTerminal score", t.score == null ? "–" : `${Math.round(t.score)}/100`],
              ["Txns 24h", num(t.txns.h24.buys + t.txns.h24.sells)],
              ["DEX", dexName(t.dex)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-raised p-2.5">
                <dt className="text-[11px] text-muted">{k}</dt>
                <dd className="font-semibold capitalize tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            {t.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 font-medium hover:bg-hover">
                {l.label} <ExternalLink className="size-3.5 text-muted" />
              </a>
            ))}
          </div>
          <p className="text-[11px] text-faint">Top-holder breakdown, snipers and insiders aren&apos;t available from our data provider yet.</p>
        </div>
      )}

      {tab === "group" &&
        (groupTrades.length ? (
          <ul>
            <li className="px-3 py-1.5 text-[11px] text-faint border-b border-line">Demo feed — shared groups are coming.</li>
            {groupTrades.map((x, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2 border-b border-line text-[12px]">
                <span className="size-7 rounded-full grid place-items-center text-[11px] font-semibold text-white" style={{ background: `hsl(${x.trader.hue} 45% 45%)` }}>
                  {x.trader.name[0].toUpperCase()}
                </span>
                <span className="flex-1">
                  <b>{x.trader.name}</b> <span className={x.side === "buy" ? "text-up" : "text-down"}>{x.side === "buy" ? "bought" : "sold"}</span>{" "}
                  <span className="tabular-nums">{x.usd} USDC</span> of {t.symbol}
                  <span className="text-muted"> · {x.group}</span>
                </span>
                <span className="text-faint tabular-nums">{x.agoMin}m</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid place-items-center text-center gap-2 py-16 px-6 text-muted">
            <p className="font-medium text-fg">No groups yet</p>
            <p className="max-w-xs text-[12px]">Join or start a group to see which friends are trading this token.</p>
            <Link href="/groups" className="mt-1 h-8 px-3.5 grid place-items-center rounded-md bg-fg text-bg text-[12px] font-semibold">Browse groups</Link>
          </div>
        ))}
    </div>
  );
}
