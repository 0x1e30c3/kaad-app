import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Bot } from "lucide-react";
import { vaultView } from "@/lib/share";
import { EXPLORER } from "@/lib/venue";
import { short, usd } from "@/lib/mock";
import { PageHeader, Panel, PanelEmpty, StatStrip, StatusPill, card } from "@/components/ui";
import WalletAvatar from "@/components/WalletAvatar";
import ShareButton from "@/components/ShareButton";

export const revalidate = 60;

export async function generateMetadata(props: PageProps<"/vault/[id]">) {
  const v = await vaultView(Number((await props.params).id));
  if (!v) return { title: "Copy vault · Kadd" };
  const who = v.leaderName ?? short(v.leader);
  return {
    title: `Copy vault #${v.id}: auto-copying ${who} · Kadd`,
    description: `${v.copies.length} trades copied, ${v.pnlPct >= 0 ? "+" : ""}${v.pnlPct.toFixed(1)}%. Limits enforced onchain: $${v.perTradeUsd} per trade, $${v.dailyCapUsd} per day.`,
  };
}

const ago = (s: number) => {
  const d = Math.max(0, Date.now() / 1000 - s);
  return d < 3600 ? `${Math.round(d / 60)}m ago` : d < 86400 ? `${Math.round(d / 3600)}h ago` : `${Math.round(d / 86400)}d ago`;
};

export default async function VaultPage(props: PageProps<"/vault/[id]">) {
  const v = await vaultView(Number((await props.params).id));
  if (!v) notFound();
  const who = v.leaderName ?? short(v.leader);
  const pnl = `${v.pnlPct >= 0 ? "+" : ""}${v.pnlPct.toFixed(1)}%`;

  return (
    <div className="p-3 md:p-5 max-w-4xl mx-auto flex flex-col gap-4">
      <PageHeader title={`Copy vault #${v.id}`} desc="A KaddCopy vault on Monad testnet. Its limits are enforced by the contract; the owner can withdraw anytime.">
        <ShareButton path={`/vault/${v.id}`} text={`My Kadd vault auto-copies ${who} on Monad: ${pnl} after ${v.copies.length} copied trades.`} />
      </PageHeader>

      <section className={`${card} -mt-2 p-5 gap-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <WalletAvatar address={v.leader} size={44} />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-muted">{v.active ? "Auto-copying" : "Was copying"}</div>
            <Link href={`/wallet/${v.leader}`} className={`text-[16px] font-semibold hover:underline ${v.leaderName ? "" : "font-mono"}`}>{who}</Link>
          </div>
          <StatusPill tone={v.active ? "up" : "muted"}>{v.active ? "Active" : "Closed"}</StatusPill>
          <Link href={`/wallet/${v.leader}#auto-copy`} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-fg text-bg text-[13px] font-semibold">
            <Bot className="size-4" /> Copy the same wallet
          </Link>
        </div>
        <StatStrip
          stats={[
            { label: "Value now", value: usd(v.valueUsd), note: `${usd(v.cashUsd)} cash` },
            { label: "Put in", value: usd(v.depositedUsd), note: "deposit + top-ups" },
            { label: "Return", value: pnl, tone: v.pnlPct >= 0 ? "up" : "down", note: `${v.pnlUsd >= 0 ? "+" : "-"}${usd(Math.abs(v.pnlUsd))}` },
            { label: "Limits", value: `$${v.perTradeUsd} / $${v.dailyCapUsd}`, note: `per trade / per day${v.copySells ? " · copies sells" : ""}` },
          ]}
        />
        {v.positions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-[12px]">
            <span className="text-muted">Holding</span>
            {v.positions.map((p) => (
              <span key={p.symbol} className="h-6 px-2 rounded-md bg-raised inline-flex items-center tabular-nums">
                {p.symbol} {usd(p.usd)}
              </span>
            ))}
          </div>
        )}
        <p className="text-[12px] text-muted">
          Owner <Link href={`/wallet/${v.owner}`} className="font-mono hover:text-fg">{short(v.owner)}</Link>
        </p>
      </section>

      <Panel title="Copied trades" count={v.copies.length}>
        {!v.copies.length ? (
          <PanelEmpty>No trades copied yet. The keeper copies the leader&apos;s next trade of a Kadd-listed token.</PanelEmpty>
        ) : (
          <ul>
            {v.copies.map((c) => (
              <li key={c.tx + c.symbol} className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 text-[13px] tabular-nums">
                <span className={`w-10 font-semibold ${c.isBuy ? "text-up" : "text-down"}`}>{c.isBuy ? "Buy" : "Sell"}</span>
                <span className="flex-1 font-semibold">{c.symbol}</span>
                <span>{usd(c.usd)}</span>
                <span className="w-20 text-right text-muted" suppressHydrationWarning>{ago(c.at)}</span>
                <a href={`${EXPLORER}/tx/${c.tx}`} target="_blank" rel="noreferrer" aria-label="View transaction" className="text-muted hover:text-fg">
                  <ArrowUpRight className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
