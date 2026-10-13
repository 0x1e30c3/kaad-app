import Link from "next/link";
import { pnlUsd, short, usd } from "@/lib/mock";
import type { WalletTrade } from "@/lib/wallets";
import { TokenIcon } from "../ui";
import WalletAvatar from "../WalletAvatar";
import { Ago, PostActions } from "./PostActions";

export type Post = WalletTrade & { name: string | null; avatar: string | null; tag: string | null };

/**
 * A real Monad mainnet trade, shown like a pump.fun callout: who, when, what, and how it has done since. A buy shows
 * its cost and the profit at today's price; a sell shows what came out and how the price moved after.
 */
export default function TradePost({ p }: { p: Post }) {
  const buy = p.side === "buy";
  const now = p.amount * p.token.price;
  const profit = buy ? now - p.usd : null;
  const move = p.price ? ((p.token.price - p.price) / p.price) * 100 : 0;
  return (
    <article className="flex gap-3 px-3 py-3.5 border-b border-line">
      <Link href={`/wallet/${p.trader}`} aria-label={`Open ${p.name ?? short(p.trader)}`} className="shrink-0">
        <WalletAvatar address={p.trader} src={p.avatar} size={36} />
      </Link>
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link href={`/wallet/${p.trader}`} className={`truncate font-semibold hover:underline ${p.name ? "" : "font-mono text-[12px]"}`}>{p.name ?? short(p.trader)}</Link>
          {p.tag && <span className="shrink-0 h-4 px-1 rounded bg-brand/15 text-brand text-[10px] font-semibold leading-4">{p.tag}</span>}
          <Ago at={p.at} />
        </div>
        <p className="text-[13px]">
          <span className={buy ? "text-up font-medium" : "text-down font-medium"}>{buy ? "Bought" : "Sold"}</span> {usd(p.usd)} of {p.token.symbol}
        </p>
        <Link href={`/token/${p.token.address}`} className="flex items-center gap-3 rounded-lg border border-line bg-raised/40 px-3 py-2.5 hover:border-line-strong hover:bg-hover">
          <TokenIcon t={p.token} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{p.token.symbol}</div>
            <div className="text-[11px] text-muted tabular-nums">{usd(p.token.price)}</div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 text-right tabular-nums">
            <dt className="text-[11px] text-faint">{buy ? "Position" : "Sold"}</dt>
            <dt className="text-[11px] text-faint">{buy ? "Profit" : "Price since"}</dt>
            <dd className="text-[13px] font-medium">{usd(p.usd)}</dd>
            {profit !== null ? (
              <dd className={`text-[13px] font-medium ${profit >= 0 ? "text-up" : "text-down"}`}>{pnlUsd(profit)}</dd>
            ) : (
              <dd className={`text-[13px] font-medium ${move >= 0 ? "text-up" : "text-down"}`}>{(move > 0 ? "+" : "") + move.toFixed(1)}%</dd>
            )}
          </dl>
        </Link>
        <PostActions trade={{ trader: p.trader, tx: p.tx, side: p.side, token: p.token }} />
      </div>
    </article>
  );
}
