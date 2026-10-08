import Link from "next/link";
import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { ArrowUpRight } from "lucide-react";
import { getWallet, aggregate, backtest } from "@/lib/wallets";
import { smartWallet } from "@/lib/nansen";
import { num, short, usd } from "@/lib/mock";
import { CopyChip, PageHeader, Panel, PanelEmpty, TokenIcon, card } from "@/components/ui";
import { copyStats } from "@/lib/events";
import WalletAvatar from "@/components/WalletAvatar";
import { AreaChart } from "@/components/charts";
import CopyAddress from "@/components/CopyAddress";
import FollowButton from "@/components/FollowButton";
import CopyButton from "@/components/CopyButton";
import { AutoCopyForm } from "@/components/AutoCopy";
import AutoRefresh from "@/components/AutoRefresh";

export const revalidate = 60;

export async function generateMetadata(props: PageProps<"/wallet/[address]">) {
  return { title: `Wallet ${short((await props.params).address)} · Kadd` };
}

const SCAN = "https://monadscan.com";
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;
const hoursSince = (ms: number) => Math.max(1, Math.round((Date.now() - ms) / 36e5));
const ago = (ms: number) => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  return s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`;
};

export default async function WalletPage(props: PageProps<"/wallet/[address]">) {
  const { address } = await props.params;
  if (!isAddress(address, { strict: false })) notFound();
  const [w, smart, copy] = await Promise.all([getWallet(address), smartWallet(address), copyStats()]);
  const copying = copy.get(address.toLowerCase());
  const row = aggregate(w.trades)[0] ?? null;
  const bt = backtest(w.trades);
  const held = w.holdings?.reduce((s, h) => s + h.usd, 0) ?? null;
  const hours = w.since ? hoursSince(w.since) : null;
  const stats: [string, React.ReactNode, string][] = [
    ["Recent volume", row ? usd(row.volume) : "$0", hours ? `last ~${hours}h` : "recent"],
    ["Trades", row ? row.trades : 0, row ? `${row.buys} buys · ${row.sells} sells` : "none in this window"],
    ["Net flow", row ? <span className={row.net >= 0 ? "text-up" : "text-down"}>{signed(row.net)}</span> : "–", "USD sold − bought"],
    ["Holdings", held === null ? "–" : usd(held), w.mon === null ? "Kadd-listed tokens" : `+ ${num(w.mon)} MON`],
  ];

  return (
    <div className="p-3 md:p-5 max-w-6xl mx-auto flex flex-col gap-4">
      <AutoRefresh seconds={60} />
      <PageHeader title="Wallet" desc="Monad mainnet wallet. Public onchain data; trades are from the tokens Kadd lists.">
        <a href={`${SCAN}/address/${w.address}`} target="_blank" rel="noreferrer" className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md border border-line-strong text-[13px] font-semibold hover:bg-hover">
          Monadscan <ArrowUpRight className="size-4" />
        </a>
        <FollowButton address={w.address} />
      </PageHeader>

      <section className={`${card} -mt-2 p-5 flex flex-col gap-5`}>
        <div className="flex items-center gap-3">
          <WalletAvatar address={w.address} src={w.avatar} size={48} />
          <div>
            <div className={`text-[16px] font-semibold ${w.nns ? "" : "font-mono"}`}>{w.nns ?? short(w.address)}</div>
            <CopyAddress address={w.address} />
            {copying && (copying.copiers > 0 || copying.copies > 0) && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted tabular-nums">
                <CopyChip n={copying.copiers} />
                {usd(copying.depositedUsd)} in Kadd copy vaults · {copying.copies} {copying.copies === 1 ? "trade" : "trades"} copied
              </p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(([k, v, note]) => (
            <div key={k} className="rounded-lg bg-raised px-3.5 py-3">
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="text-[20px] font-semibold tabular-nums tracking-[-0.01em]">{v}</dd>
              <dd className="text-[11px] text-faint" suppressHydrationWarning>{note}</dd>
            </div>
          ))}
        </dl>
        {row && row.trades > 1 && (
          <div>
            <div className="text-[12px] text-muted mb-2">Cumulative volume</div>
            <AreaChart data={row.series} height={160} kind="usd" color="var(--brand)" />
          </div>
        )}
      </section>

      {bt.copied === 0 && (
        <section id="backtest" className={`${card} scroll-mt-4 p-5 gap-1`}>
          <h2 className="text-[14px] font-semibold">Copy backtest</h2>
          <p className="text-[13px] text-muted">
            No trades by this wallet on tokens Kadd lists in the last ~{hours ?? 24}h, so there&apos;s nothing to replay yet.
            {smart ? " Nansen's 30-day PnL for it covers all of its Monad trades." : ""} Auto copy picks up its next trade.
          </p>
        </section>
      )}
      {bt.copied > 0 && (
        <section id="backtest" className={`${card} scroll-mt-4 p-5 grid gap-5 lg:grid-cols-[280px_1fr]`}>
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-[14px] font-semibold">Copy backtest</h2>
              <p className="text-[12px] text-muted" suppressHydrationWarning>If you had copied this wallet with $10 per buy{hours ? ` over the last ~${hours}h` : ""}.</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-[28px] font-semibold tabular-nums tracking-[-0.02em] ${bt.pnl >= 0 ? "text-up" : "text-down"}`}>{signed(bt.pnl)}</span>
              <span className={`h-5 px-1.5 rounded-md text-[11px] font-semibold tabular-nums inline-flex items-center ${bt.roi >= 0 ? "bg-up/12 text-up" : "bg-down/12 text-down"}`}>
                {bt.roi >= 0 ? "▲" : "▼"} {Math.abs(bt.roi).toFixed(1)}%
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-[12px] tabular-nums">
              {[["Invested", usd(bt.invested)], ["Trades copied", String(bt.copied)], ["Closed", String(bt.closed)], ["Win rate", bt.winRate === null ? "–" : `${Math.round(bt.winRate)}%`]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-raised px-2.5 py-2"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
            <p className="text-[11px] text-faint">At this wallet’s own prices, exiting when it sells, open positions at today’s price. Before fees and slippage.</p>
          </div>
          {bt.curve.length > 1 && <AreaChart data={bt.curve} height={200} kind="pnl" />}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] items-start">
        <Panel title="Recent trades" count={w.trades.length || undefined}>
          {w.trades.length === 0 ? (
            <PanelEmpty>No trades from this wallet in the latest trades of Kadd-listed tokens.</PanelEmpty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] tabular-nums whitespace-nowrap">
                <thead className="text-[11px] text-muted">
                  <tr className="border-b border-line">
                    <th className="text-left font-medium px-4 py-2">Time</th>
                    <th className="text-left font-medium px-3">Side</th>
                    <th className="text-left font-medium px-3">Token</th>
                    <th className="text-right font-medium px-3">Amount</th>
                    <th className="text-right font-medium px-3">Value</th>
                    <th className="text-right font-medium px-3 hidden sm:table-cell">Price</th>
                    <th className="px-4"><span className="sr-only">Copy</span></th>
                  </tr>
                </thead>
                <tbody>
                  {w.trades.map((t) => (
                    <tr key={t.tx + t.token.address} className="border-b border-line last:border-0 hover:bg-hover">
                      <td className="px-4 py-2.5">
                        <a href={`${SCAN}/tx/${t.tx}`} target="_blank" rel="noreferrer" className="text-muted hover:text-fg hover:underline" suppressHydrationWarning>{ago(t.at)} ago</a>
                      </td>
                      <td className={`px-3 font-medium ${t.side === "buy" ? "text-up" : "text-down"}`}>{t.side === "buy" ? "Buy" : "Sell"}</td>
                      <td className="px-3">
                        <Link href={`/token/${t.token.address}`} className="inline-flex items-center gap-2 font-semibold hover:underline">
                          <TokenIcon t={t.token} size={20} /> {t.token.symbol}
                        </Link>
                      </td>
                      <td className="px-3 text-right text-muted">{num(t.amount)}</td>
                      <td className="px-3 text-right font-medium">{usd(t.usd)}</td>
                      <td className="px-3 text-right text-muted hidden sm:table-cell">${t.price.toLocaleString("en-US", { maximumSignificantDigits: 4 })}</td>
                      <td className="px-4 text-right"><CopyButton side={t.side} token={t.token} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          {smart && (
            <article className={`${card} p-4 gap-3`}>
              <div className="flex items-center gap-2">
                <span className="h-5 px-1.5 rounded bg-up/12 text-up text-[11px] font-semibold inline-flex items-center">SMART MONEY</span>
                <span className="ml-auto text-[11px] text-faint">Nansen · 30 days</span>
              </div>
              {smart.label && <p className="text-[13px] font-medium">{smart.label}</p>}
              <div className={`text-[24px] font-semibold tabular-nums tracking-[-0.02em] ${smart.totalPnlUsd >= 0 ? "text-up" : "text-down"}`}>{signed(smart.totalPnlUsd)}</div>
              <dl className="grid grid-cols-3 gap-2 text-[12px] tabular-nums">
                <div><dt className="text-muted">Realized</dt><dd className="font-semibold">{signed(smart.realizedPnlUsd)}</dd></div>
                <div><dt className="text-muted">Win rate</dt><dd className="font-semibold">{Math.round(smart.winRatePct)}%</dd></div>
                <div><dt className="text-muted">Trades</dt><dd className="font-semibold">{smart.trades}</dd></div>
              </dl>
              <p className="text-[11px] text-faint">All of this wallet’s Monad trades, not just Kadd-listed tokens.</p>
            </article>
          )}
          <div id="auto-copy" className="scroll-mt-4">
            <AutoCopyForm leader={w.address} />
          </div>
          <Panel title="Holdings" count={w.holdings?.length || undefined}>
            {w.holdings === null ? (
              <PanelEmpty>Couldn’t read balances from Monad mainnet just now.</PanelEmpty>
            ) : w.holdings.length === 0 ? (
              <PanelEmpty>Holds none of the tokens Kadd lists right now. Bots often trade from one address and receive at another.</PanelEmpty>
            ) : (
              <ul>
                {w.holdings.map((h) => (
                  <li key={h.token.address} className="relative flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 hover:bg-hover">
                    <TokenIcon t={h.token} size={28} />
                    <Link href={`/token/${h.token.address}`} className="flex-1 min-w-0 after:absolute after:inset-0">
                      <span className="block font-semibold leading-tight">{h.token.symbol}</span>
                      <span className="block text-[12px] text-muted tabular-nums">{num(h.amount)}</span>
                    </Link>
                    <span className="font-medium tabular-nums">{usd(h.usd)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <article className={`${card} p-4 gap-2`}>
            <h2 className="text-[13px] font-semibold">On Kadd testnet · 30d</h2>
            {w.kadd ? (
              <dl className="grid grid-cols-3 gap-2 text-[12px] tabular-nums">
                <div><dt className="text-muted">PnL</dt><dd className={`font-semibold ${w.kadd.pnl >= 0 ? "text-up" : "text-down"}`}>{signed(w.kadd.pnl)}</dd></div>
                <div><dt className="text-muted">Trades</dt><dd className="font-semibold">{w.kadd.trades}</dd></div>
                <div><dt className="text-muted">Volume</dt><dd className="font-semibold">{usd(w.kadd.volume)}</dd></div>
              </dl>
            ) : (
              <p className="text-[12px] text-muted">
                This wallet hasn’t traded on Kadd yet. <Link href="/trenches" className="text-fg underline">Trade the same tokens on testnet</Link>.
              </p>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
