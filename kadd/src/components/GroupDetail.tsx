"use client";
import Link from "next/link";
import { ArrowLeft, Copy, Crown, LogOut, UserPlus } from "lucide-react";
import { FEED_TOKENS, ago, getTrader, groupFeed, type Trader } from "@/lib/mock";
import { useQuotes } from "@/lib/useQuotes";
import { allGroups, joinGroup, leaveGroup, toast, useStore } from "@/lib/store";
import { StatusPill, TokenIcon, TraderAvatar } from "./ui";
import QuickBuy from "./QuickBuy";

export default function GroupDetail({ id }: { id: string }) {
  const s = useStore();
  const g = allGroups(s).find((g) => g.id === id);
  const quotes = useQuotes(FEED_TOKENS.map((t) => t.address));

  if (!g)
    return (
      <div className="p-10 text-center text-muted">
        Group not found. <Link href="/groups" className="text-fg underline">Back to groups</Link>
      </div>
    );

  const joined = s.joined.includes(g.id);
  const members = g.members.map(getTrader).filter(Boolean) as Trader[];
  const me: Trader | null = s.user && joined ? { address: s.user.address, name: "you", hue: 80, pnl7d: 0, winRate: 0, trades: s.fills.length, volume: 0 } : null;
  const board = [...members, ...(me ? [me] : [])].sort((a, b) => b.pnl7d - a.pnl7d);
  const feed = groupFeed(g.members);

  const copyInvite = () => {
    navigator.clipboard?.writeText(g.code);
    toast(`Code ${g.code} copied`);
  };

  return (
    <div className="p-3 md:p-5 max-w-6xl mx-auto flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/groups" aria-label="Back" className="grid place-items-center size-8 rounded-md text-muted hover:text-fg hover:bg-hover">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="grid place-items-center size-11 rounded-lg bg-raised font-semibold text-[16px]">{g.name[0]}</div>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{g.name}</h1>
          <p className="text-muted">{g.desc || "No description"} · {board.length} members</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={copyInvite} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-line-strong font-medium hover:bg-hover">
            <Copy className="size-4" /> <span className="font-mono">{g.code}</span>
          </button>
          {joined ? (
            <button onClick={() => leaveGroup(g.id)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-muted hover:text-down hover:bg-hover">
              <LogOut className="size-4" /> Leave
            </button>
          ) : (
            <button onClick={() => joinGroup(g.id)} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-fg text-bg font-semibold hover:opacity-90">
              <UserPlus className="size-4" /> Join
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
        <section className="rounded-lg border border-line bg-panel overflow-hidden">
          <h2 className="px-4 h-11 flex items-center font-semibold border-b border-line">Activity <span className="ml-2 text-[11px] font-normal text-faint">demo feed</span></h2>
          {feed.length === 0 ? (
            <div className="p-8 text-center text-muted flex flex-col items-center gap-3">
              <p>No activity yet. Invite friends with your code.</p>
              <button onClick={copyInvite} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-fg text-bg font-semibold"><Copy className="size-3.5" /> Copy code {g.code}</button>
            </div>
          ) : (
            <ul>
              {feed.map((x, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0">
                  <TraderAvatar name={x.trader.name} hue={x.trader.hue} />
                  <div className="flex-1 min-w-0 text-[13px]">
                    <b>{x.trader.name}</b>{" "}
                    <span className={x.side === "buy" ? "text-up" : "text-down"}>{x.side === "buy" ? "bought" : "sold"}</span>{" "}
                    <Link href={`/token/${x.token.address}`} className="inline-flex items-center gap-1 align-middle font-semibold hover:underline">
                      <TokenIcon t={x.token} size={16} /> {x.token.symbol}
                    </Link>{" "}
                    <span className="tabular-nums text-muted">{x.usd} USDC</span>
                    <div className="text-[11px] text-faint tabular-nums">{ago(x.agoMin)}</div>
                  </div>
                  {x.side === "buy" && (
                    <QuickBuy
                      t={{ ...x.token, price: quotes[x.token.address]?.price ?? 0 }}
                      usd={x.usd}
                      label="Follow buy"
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-line-strong text-[12px] font-semibold hover:bg-hover"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-line bg-panel overflow-hidden">
          <h2 className="px-4 h-11 flex items-center gap-2 font-semibold border-b border-line">
            Leaderboard this week
            <StatusPill tone="warn">Demo Data</StatusPill>
          </h2>
          <ol>
            {board.map((m, i) => (
              <li key={m.address} className={`flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 ${m === me ? "bg-raised" : ""}`}>
                <span className="w-5 text-center tabular-nums text-muted">{i === 0 ? <Crown className="size-4 text-warn mx-auto" /> : i + 1}</span>
                <TraderAvatar name={m.name} hue={m.hue} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-[11px] text-muted tabular-nums">{m.trades} trades{m !== me && ` · win ${m.winRate}%`}</div>
                </div>
                <span className={`tabular-nums font-semibold ${m.pnl7d >= 0 ? "text-up" : "text-down"}`}>
                  {m.pnl7d >= 0 ? "+" : "-"}${Math.abs(m.pnl7d).toLocaleString("en-US")}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
