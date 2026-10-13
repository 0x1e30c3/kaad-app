import Link from "next/link";
import { Bot } from "lucide-react";
import type { CopyBoardRow } from "@/lib/share";
import { Panel, PanelEmpty, Pct, btnSm } from "./ui";
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
          {rows.map((r) => (
            <li key={`${r.kind}${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <WalletAvatar address={r.leader} size={32} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{r.name}</span>
              <span className="text-right">
                <span className="block text-[11px] text-muted">PnL · since inception</span>
                <Pct v={r.returnPct} className="text-[14px] font-semibold" />
              </span>
              <Link href={r.kind === "vault" ? `/vault/${r.id}` : "/groups#copy-clubs"} aria-label={`View ${r.name}`} className={btnSm}>View</Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
