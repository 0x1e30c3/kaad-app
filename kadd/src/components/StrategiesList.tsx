"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, Workflow } from "lucide-react";
import { toast, useStore } from "@/lib/store";
import { KIND_LABEL, STRATEGIES_READY, cancelStrategy, executeStrategy, strategiesOf } from "@/lib/strategies";
import { useAsync } from "@/lib/useAsync";
import { txError } from "@/lib/venue";

const sig = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
const dur = (s: number) => (s >= 86400 ? `${s / 86400}d` : `${s / 3600}h`);

/** Your strategies (optionally for one token): status, fill now, cancel. */
export default function StrategiesList({ source, compact }: { source?: string; compact?: boolean }) {
  const { user, rev } = useStore();
  const { data, loading } = useAsync(() => (user ? strategiesOf(user.address) : Promise.resolve([])), [user?.address, rev]);
  const [busy, setBusy] = useState<string | null>(null);
  if (!STRATEGIES_READY || !user) return null;
  const rows = (data ?? []).filter((s) => !source || s.market.source.toLowerCase() === source);
  const open = rows.filter((s) => !s.done);
  if (compact && !open.length) return null;

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(txError(e), "err");
    }
    setBusy(null);
  };

  return (
    <section className={compact ? "border-t border-line" : "rounded-lg border border-line bg-panel overflow-hidden"}>
      <h2 className={`flex items-center gap-2 font-semibold ${compact ? "px-3 pt-3 text-[13px]" : "px-4 h-11 border-b border-line"}`}>
        <Workflow className="size-4" /> {compact ? "Your orders" : "Strategies"} <span className="text-faint font-normal">{open.length}</span>
      </h2>
      {loading && !data ? (
        <div className="h-14 grid place-items-center text-muted"><Loader2 className="size-4 animate-spin" /></div>
      ) : !rows.length ? (
        <p className="p-6 text-center text-muted text-[13px]">No strategies yet. Open any token and pick Limit, TP / SL or DCA in the trade panel.</p>
      ) : (
        <ul className={compact ? "p-2" : ""}>
          {(compact ? open : rows).map((s) => {
            const unit = s.isBuy ? "tUSDC" : s.market.symbol;
            const status = s.done ? "Done" : s.ready ? "Filling…" : s.kind === "dca" && !s.trigger ? `Next ${new Date(s.nextAt * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Waiting";
            return (
              <li key={String(s.id)} className={`flex items-center gap-3 py-2 text-[12px] ${compact ? "px-1" : "px-4 border-b border-line last:border-0"} ${s.done ? "opacity-60" : ""}`}>
                <span className="flex-1 min-w-0">
                  <span className="font-semibold">{KIND_LABEL[s.kind]}</span>{" "}
                  {!compact && <Link href={`/token/${s.market.source.toLowerCase()}`} className="hover:underline">{s.market.symbol}</Link>}
                  <span className="block text-muted tabular-nums">
                    {s.kind === "dca"
                      ? `${sig(s.perExec)} tUSDC every ${dur(s.interval)}${s.trigger ? ` below $${sig(s.trigger)}` : ""} · ${sig(s.remaining)} left`
                      : `${sig(s.remaining)} ${unit} ${s.kind === "limit" ? "at" : s.kind === "takeProfit" ? "at ≥" : "if ≤"} $${sig(s.trigger ?? 0)}`}
                  </span>
                </span>
                <span className={`tabular-nums ${s.ready ? "text-up" : "text-muted"}`}>{status}</span>
                {!s.done && s.ready && (
                  <button onClick={() => act(`x${s.id}`, () => executeStrategy(s.id).then(() => toast(`${KIND_LABEL[s.kind]} filled`)))} disabled={!!busy} className="h-7 px-2 rounded-md bg-fg text-bg font-semibold disabled:opacity-40 inline-flex items-center gap-1">
                    {busy === `x${s.id}` && <Loader2 className="size-3 animate-spin" />} Fill
                  </button>
                )}
                {!s.done && (
                  <button onClick={() => act(`c${s.id}`, () => cancelStrategy(s.id))} disabled={!!busy} className="h-7 px-2 rounded-md border border-line-strong font-semibold hover:bg-hover disabled:opacity-40 inline-flex items-center gap-1">
                    {busy === `c${s.id}` && <Loader2 className="size-3 animate-spin" />} Cancel
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
