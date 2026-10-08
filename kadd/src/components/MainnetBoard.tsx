"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ShoppingCart, Star, Trophy, Zap } from "lucide-react";
import type { MainnetBoard as Board, MainnetRow } from "@/lib/wallets";
import { short, usd } from "@/lib/mock";
import { toggleFollow, useStore } from "@/lib/store";
import { TokenIcon, card, CopyChip } from "./ui";
import WalletAvatar from "./WalletAvatar";
import { AreaChart } from "./charts";

type SortKey = "volume" | "trades" | "net" | "lastAt" | "copyRoi";

const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;
const ago = (ms: number) => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  return s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`;
};

const Tokens = ({ tokens }: { tokens: MainnetRow["tokens"] }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="flex -space-x-1.5">
      {tokens.slice(0, 3).map((t) => <span key={t.address} className="ring-2 ring-panel rounded-full" title={t.symbol}><TokenIcon t={t} size={18} /></span>)}
    </span>
    <span className="text-[12px] text-muted">{tokens.length === 1 ? tokens[0].symbol : `${tokens.length} tokens`}</span>
  </span>
);

export default function MainnetBoard({ board }: { board: Board }) {
  const { user, following } = useStore();
  const [onlyFollowing, setOnlyFollowing] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "volume", desc: true });
  const me = user?.address.toLowerCase();
  const hours = board.since ? Math.max(1, Math.round((Date.now() - board.since) / 36e5)) : null;

  const ranked = board.rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const shown = (onlyFollowing ? ranked.filter((r) => following.includes(r.address)) : ranked).sort((a, b) => (b[sort.key] - a[sort.key]) * (sort.desc ? 1 : -1));
  const top = (f: (r: MainnetRow) => number) => [...ranked].sort((a, b) => f(b) - f(a))[0];
  const highlights = ranked.length
    ? [
        { icon: <Trophy />, label: "Top volume", row: ranked[0], value: usd(ranked[0].volume) },
        { icon: <Zap />, label: "Most active", row: top((r) => r.trades), value: `${top((r) => r.trades).trades} trades` },
        { icon: <ShoppingCart />, label: "Biggest buyer", row: top((r) => -r.net), value: <span className="text-up">{usd(-top((r) => -r.net).net)}</span> },
      ]
    : [];

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
  const avatar = (r: MainnetRow, size: number) => <WalletAvatar address={r.address} src={r.avatar} size={size} />;
  const nameOf = (r: MainnetRow) => (r.address === me ? "You" : r.nns ?? short(r.address));

  return (
    <>
      {highlights.length > 0 && (
        <section className="-mx-3 px-3 md:mx-0 md:px-0 flex gap-3 overflow-x-auto snap-x md:grid md:grid-cols-3 md:overflow-visible">
          {highlights.map((h) => (
            <article key={h.label} className={`${card} p-4 gap-3 shrink-0 w-[85%] snap-start md:w-auto`}>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted [&>svg]:size-3.5">{h.icon}{h.label}</div>
              <div className="flex items-center gap-2.5">
                {avatar(h.row, 32)}
                <div className="min-w-0 flex-1">
                  <Link href={`/wallet/${h.row.address}`} className={`block truncate text-[14px] font-semibold hover:underline after:absolute after:inset-0 ${h.row.nns ? "" : "font-mono"}`}>{nameOf(h.row)}</Link>
                  <div className="mt-0.5"><Tokens tokens={h.row.tokens} /></div>
                </div>
                <div className="text-[18px] font-semibold tabular-nums tracking-[-0.01em]">{h.value}</div>
              </div>
              <div className="relative z-10">
                <AreaChart data={h.row.series} height={48} axes={false} kind="usd" color="var(--brand)" />
              </div>
            </article>
          ))}
        </section>
      )}

      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line">
          <span className="text-[12px] text-muted" suppressHydrationWarning>
            {hours ? `Latest trades from the last ~${hours}h` : "Latest trades"} on the mainnet pools of tokens you can trade on Kadd.
          </span>
          <button
            onClick={() => setOnlyFollowing(!onlyFollowing)}
            aria-pressed={onlyFollowing}
            className={`ml-auto h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium border ${onlyFollowing ? "border-fg bg-fg text-bg" : "border-line-strong hover:bg-hover"}`}
          >
            <Star className={`size-3.5 ${onlyFollowing ? "fill-current" : ""}`} /> Following {following.length}
          </button>
        </div>
        {board.failed && !ranked.length ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">Couldn’t load mainnet trades just now. This page retries every minute.</p>
        ) : shown.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">
            {onlyFollowing ? "None of the wallets you follow traded in this window. Tap ★ on any wallet to follow it." : "No trades in this window yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tabular-nums whitespace-nowrap">
              <thead className="text-[11px] text-muted">
                <tr className="border-b border-line">
                  <th className="w-8 pl-3" aria-label="Follow" />
                  <th className="w-10 py-3 font-medium">#</th>
                  <th className="text-left font-medium px-3">Wallet</th>
                  {th("volume", "Volume")}
                  {th("trades", "Trades", "hidden sm:table-cell")}
                  <th className="text-right font-medium px-3 hidden md:table-cell">Buys / sells</th>
                  {th("net", "Net flow", "hidden md:table-cell")}
                  {th("copyRoi", "Copy ROI", "hidden sm:table-cell")}
                  <th className="text-left font-medium px-3 hidden lg:table-cell">Tokens</th>
                  {th("lastAt", "Last trade", "hidden sm:table-cell")}
                  <th className="text-right font-medium px-4 hidden lg:table-cell">Volume trend</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const followed = following.includes(r.address);
                  return (
                    <tr key={r.address} className={`relative border-b border-line last:border-0 hover:bg-hover ${r.address === me ? "bg-brand/5" : ""}`}>
                      <td className="pl-3">
                        <button onClick={() => toggleFollow(r.address)} aria-label={followed ? "Unfollow" : "Follow"} aria-pressed={followed} className={`relative z-10 grid place-items-center size-6 rounded hover:bg-raised ${followed ? "text-warn" : "text-faint hover:text-fg"}`}>
                          <Star className={`size-3.5 ${followed ? "fill-current" : ""}`} />
                        </button>
                      </td>
                      <td className="py-3 text-center text-muted">{r.rank}</td>
                      <td className="px-3">
                        <div className="flex items-center gap-2.5">
                          {avatar(r, 26)}
                          <div className="leading-tight">
                            <Link href={`/wallet/${r.address}`} className={`font-semibold hover:underline after:absolute after:inset-0 ${r.nns ? "" : "font-mono"}`}>{nameOf(r)}</Link>
                            <CopyChip n={r.copiers} className="ml-1.5 align-middle" />
                            {r.smart !== null && (
                              <span title={`Nansen smart money${r.smart ? `: ${r.smart}` : ""}`} className="ml-1.5 align-middle h-4 px-1 rounded bg-up/12 text-up text-[10px] font-semibold inline-flex items-center">SMART</span>
                            )}
                            {r.nns && <div className="font-mono text-[11px] text-faint">{short(r.address)}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 text-right font-semibold">{usd(r.volume)}</td>
                      <td className="px-3 text-right hidden sm:table-cell">{r.trades}</td>
                      <td className="px-3 hidden md:table-cell">
                        <div className="flex items-center justify-end gap-2" title={`${r.buys} buys · ${r.sells} sells`}>
                          <span className="text-[11px] text-up">{r.buys}</span>
                          <div className="w-16 h-1.5 rounded-full bg-down/70 overflow-hidden"><div className="h-full bg-up" style={{ width: `${(r.buys / r.trades) * 100}%` }} /></div>
                          <span className="text-[11px] text-down">{r.sells}</span>
                        </div>
                      </td>
                      <td className={`px-3 text-right hidden md:table-cell ${r.net >= 0 ? "text-up" : "text-down"}`} title="USD sold minus USD bought">{signed(r.net)}</td>
                      <td className="px-3 text-right hidden sm:table-cell" title={`Copying $10 per buy: ${signed(r.copyPnl)}`}>
                        <span className={`inline-flex items-center gap-0.5 font-medium ${r.copyRoi >= 0 ? "text-up" : "text-down"}`}>
                          <span className="text-[9px]">{r.copyRoi >= 0 ? "▲" : "▼"}</span>{Math.abs(r.copyRoi).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 hidden lg:table-cell"><Tokens tokens={r.tokens} /></td>
                      <td className="px-3 text-right text-muted hidden sm:table-cell" suppressHydrationWarning>{ago(r.lastAt)} ago</td>
                      <td className="px-4 hidden lg:table-cell">
                        <div className="relative z-10 w-24 ml-auto"><AreaChart data={r.series} height={32} axes={false} fill={false} kind="usd" color="var(--brand)" /></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="-mt-2 text-[11px] text-faint">
        Public Monad mainnet data from GeckoTerminal (the latest 300 trades per pool). Net flow is USD sold minus USD bought in this window. Copy ROI is a backtest: $10 per buy at the wallet’s prices, exiting when it sells, before fees and slippage.
      </p>
    </>
  );
}
