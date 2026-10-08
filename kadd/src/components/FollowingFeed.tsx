"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import type { FeedItem } from "@/lib/wallets";
import { short, usd } from "@/lib/mock";
import { setCopySize, useStore } from "@/lib/store";
import { useAsync } from "@/lib/useAsync";
import { PanelEmpty, TokenIcon, card } from "./ui";
import WalletAvatar from "./WalletAvatar";
import CopyButton from "./CopyButton";
import NotifyToggle from "./NotifyToggle";

const SIZES = [10, 25, 50, 100];
const ago = (ms: number) => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  return s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`;
};

/** Live mainnet trades from the wallets you follow, each one copyable on Kadd testnet in one tap. */
export default function FollowingFeed() {
  const { following, copySize } = useStore();
  const key = following.join(",");
  const { data, error, loading, reload } = useAsync<FeedItem[]>(
    () => (key ? fetch(`/api/feed?w=${key}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Feed unavailable")))) : Promise.resolve([])),
    [key],
  );
  useEffect(() => {
    const id = setInterval(reload, 30_000);
    return () => clearInterval(id);
  }, [reload]);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-[15px] font-semibold">Following</h2>
        <span className="text-[13px] text-faint tabular-nums">{following.length}</span>
        <span className="text-[12px] text-muted hidden sm:inline">· live Monad mainnet trades, copy them on testnet</span>
        <div className="ml-auto flex items-center gap-1.5">
          {following.length > 0 && <NotifyToggle />}
          <span className="text-[12px] text-muted">Copy size</span>
          <div role="radiogroup" aria-label="Copy size" className="flex p-0.5 rounded-md bg-raised text-[12px] font-medium">
            {SIZES.map((n) => (
              <button key={n} role="radio" aria-checked={copySize === n} onClick={() => setCopySize(n)} className={`h-7 px-2.5 rounded tabular-nums ${copySize === n ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`}>
                ${n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        {following.length === 0 ? (
          <div className="px-5 py-8 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="font-semibold">Follow real traders</div>
              <p className="text-[13px] text-muted">Star wallets on the Leaderboard. Their Monad mainnet trades show up here, and you can copy each one on Kadd testnet in one tap.</p>
            </div>
            <Link href="/leaderboard" className="h-9 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-fg text-bg text-[13px] font-semibold hover:opacity-90">
              <Star className="size-3.5" /> Find wallets <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : loading ? (
          <ul>{[0, 1, 2].map((i) => <li key={i} className="h-14 border-b border-line last:border-0 animate-pulse bg-raised/40" />)}</ul>
        ) : error && !data ? (
          <PanelEmpty>Couldn’t load trades just now. Retrying every 30 seconds.</PanelEmpty>
        ) : !data?.length ? (
          <PanelEmpty>No trades from the wallets you follow in the latest window. New ones appear here within a few minutes.</PanelEmpty>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto">
            {data.map((t) => (
              <li key={t.tx + t.token.address} className="relative flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 hover:bg-hover">
                <WalletAvatar address={t.trader} src={t.avatar} size={28} />
                <div className="min-w-0 flex-1 text-[13px]">
                  <div className="truncate">
                    <Link href={`/wallet/${t.trader}`} className={`font-semibold hover:underline after:absolute after:inset-0 ${t.nns ? "" : "font-mono"}`}>{t.nns ?? short(t.trader)}</Link>{" "}
                    <span className={t.side === "buy" ? "text-up" : "text-down"}>{t.side === "buy" ? "bought" : "sold"}</span>{" "}
                    <span className="font-medium tabular-nums">{usd(t.usd)}</span> of
                  </div>
                  <Link href={`/token/${t.token.address}`} className="relative z-10 inline-flex items-center gap-1.5 text-muted hover:text-fg">
                    <TokenIcon t={t.token} size={16} /> {t.token.symbol}
                  </Link>
                </div>
                <span className="text-[12px] text-faint tabular-nums" suppressHydrationWarning>{ago(t.at)}</span>
                <CopyButton side={t.side} token={t.token} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
