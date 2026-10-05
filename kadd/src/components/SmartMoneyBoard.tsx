"use client";
import { useState } from "react";
import Link from "next/link";
import { Bot, ChevronDown, ChevronUp, FlaskConical, Star } from "lucide-react";
import type { SmartMoney, SmartWallet } from "@/lib/nansen";
import type { MainnetRow } from "@/lib/wallets";
import { short } from "@/lib/mock";
import { toggleFollow, useStore } from "@/lib/store";
import { card } from "./ui";
import WalletAvatar from "./WalletAvatar";

type SortKey = "totalPnlUsd" | "realizedPnlUsd" | "winRatePct" | "trades";
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;

/**
 * Nansen's labelled Monad smart-money wallets by 30-day PnL, made actionable: the ones trading Kadd-listed tokens
 * right now come first with a copy backtest, and every wallet can be backtested or auto-copied in one click.
 */
export default function SmartMoneyBoard({ data, active }: { data: SmartMoney; active: MainnetRow[] }) {
  const { following } = useStore();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "totalPnlUsd", desc: true });
  const now = new Map(active.map((r) => [r.address, r]));
  const rows = [...(data?.wallets ?? [])].sort((a, b) => (b[sort.key] - a[sort.key]) * (sort.desc ? 1 : -1));
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

  const action = "relative z-10 h-7 px-2 inline-flex items-center gap-1 rounded-md border border-line-strong text-[12px] font-medium hover:bg-hover";
  const live = rows.filter((w) => now.has(w.address));

  return (
    <>
      {data && (
        <section className={`${card} p-4 gap-3`}>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-[14px] font-semibold">Smart money trading now</h2>
            <span className="text-[12px] text-muted">Nansen-labelled wallets that traded tokens you can trade on Kadd in the last ~24h</span>
          </div>
          {!live.length ? (
            <p className="text-[13px] text-muted">None of them traded a Kadd-listed token in the latest window. Follow one below and its next trade shows up in your feed.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {live.map((w) => {
                const r = now.get(w.address)!;
                return (
                  <article key={w.address} className="relative flex flex-col gap-2 rounded-lg border border-line p-3 hover:border-line-strong">
                    <div className="flex items-center gap-2">
                      <WalletAvatar address={w.address} size={24} />
                      <Link href={`/wallet/${w.address}`} className="font-mono text-[13px] font-semibold hover:underline after:absolute after:inset-0">{short(w.address)}</Link>
                      <span className={`ml-auto text-[13px] font-semibold tabular-nums ${w.totalPnlUsd >= 0 ? "text-up" : "text-down"}`}>{signed(w.totalPnlUsd)} <span className="text-[11px] font-normal text-faint">30d</span></span>
                    </div>
                    <div className="text-[12px] text-muted tabular-nums">
                      {r.trades} trades today in {r.tokens.map((t) => t.symbol).join(", ")} · copy ROI{" "}
                      <span className={r.copyRoi >= 0 ? "text-up" : "text-down"}>{r.copyRoi >= 0 ? "+" : ""}{r.copyRoi.toFixed(1)}%</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Link href={`/wallet/${w.address}#backtest`} className={action}><FlaskConical className="size-3.5" /> Backtest</Link>
                      <Link href={`/wallet/${w.address}#auto-copy`} className={action}><Bot className="size-3.5" /> Auto-copy</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line">
          <span className="h-6 px-2 rounded-md bg-raised text-[11px] font-semibold inline-flex items-center">Powered by Nansen</span>
          <span className="text-[12px] text-muted">Wallets Nansen labels as smart money on Monad, ranked by 30-day PnL. Refreshed daily.</span>
        </div>
        {!data ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">Nansen data isn’t available right now. The other tabs work without it.</p>
        ) : !rows.length ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">Nansen has no smart-money wallets on Monad in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tabular-nums whitespace-nowrap">
              <thead className="text-[11px] text-muted">
                <tr className="border-b border-line">
                  <th className="w-8 pl-3" aria-label="Follow" />
                  <th className="w-10 py-3 font-medium">#</th>
                  <th className="text-left font-medium px-3">Wallet</th>
                  {th("totalPnlUsd", "PnL 30d")}
                  {th("realizedPnlUsd", "Realized", "hidden sm:table-cell")}
                  {th("winRatePct", "Win rate", "hidden md:table-cell")}
                  {th("trades", "Trades", "hidden md:table-cell")}
                  <th className="text-left font-medium px-4 hidden lg:table-cell">Top tokens</th>
                  <th className="text-right font-medium px-4">Act</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w: SmartWallet, i) => {
                  const followed = following.includes(w.address);
                  return (
                    <tr key={w.address} className="relative border-b border-line last:border-0 hover:bg-hover">
                      <td className="pl-3">
                        <button onClick={() => toggleFollow(w.address)} aria-label={followed ? "Unfollow" : "Follow"} aria-pressed={followed} className={`relative z-10 grid place-items-center size-6 rounded hover:bg-raised ${followed ? "text-warn" : "text-faint hover:text-fg"}`}>
                          <Star className={`size-3.5 ${followed ? "fill-current" : ""}`} />
                        </button>
                      </td>
                      <td className="py-3 text-center text-muted">{i + 1}</td>
                      <td className="px-3">
                        <div className="flex items-center gap-2.5">
                          <WalletAvatar address={w.address} size={26} />
                          <div className="leading-tight min-w-0">
                            <Link href={`/wallet/${w.address}`} className="font-mono font-semibold hover:underline after:absolute after:inset-0">{short(w.address)}</Link>
                            {w.label && <div className="text-[11px] text-muted truncate max-w-[220px]" title={w.label}>{w.label}</div>}
                            {now.has(w.address) && <div className="text-[10px] font-semibold text-up">● trading now</div>}
                          </div>
                        </div>
                      </td>
                      <td className={`px-3 text-right font-semibold ${w.totalPnlUsd >= 0 ? "text-up" : "text-down"}`}>{signed(w.totalPnlUsd)}</td>
                      <td className="px-3 text-right hidden sm:table-cell">{signed(w.realizedPnlUsd)}</td>
                      <td className="px-3 hidden md:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1 rounded-full bg-raised overflow-hidden"><div className="h-full rounded-full bg-fg/60" style={{ width: `${w.winRatePct}%` }} /></div>
                          <span className="w-9 text-right">{Math.round(w.winRatePct)}%</span>
                        </div>
                      </td>
                      <td className="px-3 text-right hidden md:table-cell">{w.trades}</td>
                      <td className="px-4 hidden lg:table-cell">
                        <span className="inline-flex flex-wrap gap-1">
                          {w.topTokens.slice(0, 3).map((t) => (
                            <span key={t.address} className="h-5 px-1.5 rounded-md bg-raised text-[11px] inline-flex items-center gap-1">
                              {/* eslint-disable-next-line @next/next/no-img-element -- token logos from Nansen's CDN */}
                              {t.logo && <img src={t.logo} alt="" className="size-3 rounded-full" />}
                              {t.symbol}
                            </span>
                          ))}
                          {!w.topTokens.length && <span className="text-faint">–</span>}
                        </span>
                      </td>
                      <td className="px-4">
                        <div className="flex justify-end gap-1.5">
                          <Link href={`/wallet/${w.address}#backtest`} className={action} title="Backtest copying this wallet"><FlaskConical className="size-3.5" /><span className="hidden xl:inline">Backtest</span></Link>
                          <Link href={`/wallet/${w.address}#auto-copy`} className={action} title="Auto-copy with contract-enforced limits"><Bot className="size-3.5" /><span className="hidden xl:inline">Auto-copy</span></Link>
                        </div>
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
        Labels and PnL from Nansen ({data ? `${rows.length} wallets, 30 days` : "unavailable"}). PnL covers all of a wallet’s Monad trades, realized and unrealized.
      </p>
    </>
  );
}
