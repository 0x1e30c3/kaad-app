"use client";
import { useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { pnlUsd, short } from "@/lib/mock";
import WalletAvatar from "../WalletAvatar";
import Pane, { Tabs } from "./Pane";

export type BoardEntry = { address: string; name: string | null; avatar: string | null; pnl: number; href: string };
type Key = "smart" | "perps" | "kadd";
const BOARDS = [["smart", "Smart money"], ["perps", "Perps"], ["kadd", "Kadd"]] as const;
const NOTE: Record<Key, string> = {
  smart: "Monad mainnet · 30d PnL (Nansen)",
  perps: "Perpl · all-time PnL",
  kadd: "Kadd testnet · 7d PnL",
};
const EMPTY: Record<Key, string> = {
  smart: "Smart-money data is unavailable right now.",
  perps: "Perpl data is unavailable right now.",
  kadd: "No Kadd trades this week yet. Make the first one.",
};

/** Ranked wallets by profit, one tab per source: mainnet smart money, Perpl perps, and Kadd's own testnet traders. */
export default function BoardPane({ boards, perpsNote }: { boards: Record<Key, BoardEntry[]>; perpsNote?: string }) {
  const [key, setKey] = useState<Key>(boards.smart.length ? "smart" : "perps");
  const rows = boards[key];
  return (
    <Pane
      icon={<Trophy />}
      title="Leaderboard"
      meta={<Link href="/leaderboard" className="hover:text-fg hover:underline">See all →</Link>}
      controls={<><Tabs label="Leaderboard" value={key} options={BOARDS} onChange={setKey} /><span className="ml-auto text-[11px] text-faint truncate">{key === "perps" && perpsNote ? perpsNote : NOTE[key]}</span></>}
    >
      <ol>
        {rows.map((r, i) => (
          <li key={r.address} className="relative flex items-center gap-3 px-3 h-12 border-b border-line hover:bg-hover">
            <span className={`w-5 text-right text-[12px] tabular-nums ${i < 3 ? "text-fg font-semibold" : "text-faint"}`}>{i + 1}</span>
            <WalletAvatar address={r.address} src={r.avatar} size={28} />
            <Link href={r.href} className={`min-w-0 flex-1 truncate font-medium after:absolute after:inset-0 ${r.name ? "" : "font-mono text-[12px]"}`}>{r.name ?? short(r.address)}</Link>
            <span className={`text-[13px] font-semibold tabular-nums ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{pnlUsd(r.pnl)}</span>
          </li>
        ))}
      </ol>
      {!rows.length && <p className="p-6 text-center text-muted">{EMPTY[key]}</p>}
    </Pane>
  );
}
