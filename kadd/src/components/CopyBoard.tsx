import Link from "next/link";
import { Bot } from "lucide-react";
import type { CopyBoardRow } from "@/lib/share";
import { short, usd } from "@/lib/mock";
import { Panel, PanelEmpty } from "./ui";
import WalletAvatar from "./WalletAvatar";

/** Kadd's auto copy vaults and copy clubs ranked by return since they started. */
export default function CopyBoard({ rows }: { rows: CopyBoardRow[] }) {
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><Bot className="size-4 text-muted" /> Best auto copy on Kadd</span>} count={rows.length || undefined}>
      {!rows.length ? (
        <PanelEmpty>
          No live copy vaults yet. <Link href="/start" className="text-fg underline">Copy a trader</Link> or <Link href="/groups#copy-clubs" className="text-fg underline">start a copy club</Link>.
        </PanelEmpty>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={`${r.kind}${r.id}`}>
              <Link href={r.kind === "vault" ? `/vault/${r.id}` : "/groups#copy-clubs"} className="grid grid-cols-[24px_32px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-hover">
                <span className="text-[12px] text-faint tabular-nums">{i + 1}</span>
                <WalletAvatar address={r.leader} size={32} />
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold truncate">{r.name}</span>
                  <span className="block text-[12px] text-muted truncate tabular-nums">
                    {r.kind === "club" ? `Club · ${r.members} member${r.members === 1 ? "" : "s"}` : "Vault"} · copies <span className="font-mono">{short(r.leader)}</span> · {r.copies} trades
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className={`block text-[14px] font-semibold ${r.returnPct >= 0 ? "text-up" : "text-down"}`}>
                    {r.returnPct >= 0 ? "+" : ""}
                    {r.returnPct.toFixed(1)}%
                  </span>
                  <span className="block text-[12px] text-muted">{usd(r.valueUsd)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
