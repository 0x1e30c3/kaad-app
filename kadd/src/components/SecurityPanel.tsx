"use client";
import { useState } from "react";
import { KeyRound, Loader2, Lock, ShieldCheck, Unlock } from "lucide-react";
import { approvalsOf, revoke, type Approval } from "@/lib/security";
import { refreshChain, requireAccount, toast, useStore } from "@/lib/store";
import { useAsync } from "@/lib/useAsync";
import { txError } from "@/lib/venue";
import { isUnlocked, lock } from "@/lib/wallet";

const UNLIMITED = 2n ** 255n;

/** Session state + every token approval Kadd contracts hold on this wallet, with one-click revoke. */
export default function SecurityPanel() {
  const { user, rev } = useStore();
  const { data, loading, error, reload } = useAsync(() => (user ? approvalsOf(user.address) : Promise.resolve([])), [user?.address, rev]);
  const [busy, setBusy] = useState<string | null>(null);
  const unlocked = isUnlocked();

  const onRevoke = async (a: Approval) => {
    const key = a.token + a.spender;
    setBusy(key);
    try {
      if (!(await requireAccount())) return;
      await revoke(a);
      toast(`Revoked ${a.symbol} approval for ${a.spenderLabel}`);
      refreshChain();
      reload();
    } catch (e) {
      toast(txError(e), "err");
    } finally {
      setBusy(null);
    }
  };

  if (!user) return null;
  return (
    <section className="rounded-lg border border-line bg-panel overflow-hidden">
      <h2 className="px-4 h-11 flex items-center gap-2 font-semibold border-b border-line"><ShieldCheck className="size-4" /> Security</h2>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line text-[13px]">
        {unlocked ? <Unlock className="size-4 text-up" /> : <Lock className="size-4 text-muted" />}
        <div className="flex-1">
          <div className="font-medium">{unlocked ? "Signing session active" : "Session locked"}</div>
          <div className="text-[12px] text-muted">
            {unlocked ? "Trades sign without prompts until you lock or close the tab. Keys live only in memory." : "Your passkey is needed before the next transaction."}
          </div>
        </div>
        {unlocked && (
          <button onClick={() => (lock(), refreshChain(), toast("Session locked"))} className="h-8 px-3 rounded-md border border-line-strong text-[12px] font-semibold hover:bg-hover">
            Lock now
          </button>
        )}
      </div>
      <div className="px-4 pt-3 pb-1 text-[12px] text-muted">
        Approvals let a contract move your tokens. Kadd asks once per token so each trade is a single signature. Revoke any you no longer use.
      </div>
      {loading && !data ? (
        <div className="h-16 grid place-items-center text-muted"><Loader2 className="size-4 animate-spin" /></div>
      ) : error ? (
        <p className="px-4 py-3 text-[12px] text-down">Couldn’t read approvals from Monad testnet.</p>
      ) : !data?.length ? (
        <p className="px-4 py-3 text-[13px] text-muted">No open approvals.</p>
      ) : (
        <ul>
          {data.map((a) => (
            <li key={a.token + a.spender} className="flex items-center gap-3 px-4 py-2.5 border-t border-line text-[13px]">
              <KeyRound className="size-4 text-muted shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="font-medium">{a.symbol}</span> <span className="text-muted">→ {a.spenderLabel}</span>
              </span>
              <span className="text-[12px] text-muted tabular-nums">{a.amount >= UNLIMITED ? "Unlimited" : "Limited"}</span>
              <button
                onClick={() => onRevoke(a)}
                disabled={!!busy}
                className="h-7 px-2.5 rounded-md border border-line-strong text-[12px] font-semibold hover:bg-hover disabled:opacity-40 inline-flex items-center gap-1"
              >
                {busy === a.token + a.spender && <Loader2 className="size-3 animate-spin" />} Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
