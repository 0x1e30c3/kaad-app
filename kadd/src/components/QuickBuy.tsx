"use client";
import { useRef, useState } from "react";
import { Loader2, Zap } from "lucide-react";
import type { TokenRef } from "@/lib/market";
import type { Risk } from "@/lib/mock";
import { buyToken } from "@/lib/swap";
import { practiceOneClick } from "@/lib/quickBuyPreference";
import { toast } from "@/lib/store";

/** Practice orders require review unless the user explicitly enables one-click. */
export default function QuickBuy({ t, usd, className }: { t: TokenRef & { price: number; risk?: Risk }; usd: number; className: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState({ token: t, amount: usd });
  const dialog = useRef<HTMLDialogElement>(null);
  const running = useRef(false);
  const buy = async (token: typeof t, amount: number) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try { await buyToken(token, amount); }
    catch { toast("Practice buy failed. Check your balance before retrying."); }
    finally { running.current = false; setBusy(false); dialog.current?.close(); }
  };
  return <>
    <button onClick={() => {
      if (practiceOneClick() && t.risk === "safe") { void buy(t, usd); return; }
      setOrder({ token: t, amount: usd });
      dialog.current?.showModal();
    }} disabled={busy || !Number.isFinite(usd) || usd <= 0} title="Practice buy on Monad testnet"
      className={`${className} disabled:opacity-60`}>
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />} Buy {usd} tUSDC
    </button>
    <dialog ref={dialog} aria-label="Review practice buy" onCancel={(e) => { if (busy) e.preventDefault(); }}
      className="m-auto w-[min(400px,calc(100vw-32px))] rounded-xl border border-line bg-panel text-fg p-5 shadow-xl backdrop:bg-black/50">
      <h2 className="font-semibold text-[16px]">Review practice buy</h2>
      <p className="my-3 break-words">Spend {order.amount} tUSDC to buy {order.token.name} ({order.token.symbol}).</p>
      <p className="text-muted text-[12px]">Execution: Monad testnet mirror, free test tokens. Market price: Monad mainnet.</p>
      {order.token.risk === "safe" && <p className="my-3 text-[12px] text-muted">Risk: low screening risk, not a guarantee. Prices can fall and liquidity can change; you may be unable to sell.</p>}
      {order.token.risk !== "safe" && <p role="alert" className="my-3 text-[12px] text-down">{order.token.risk === "danger" ? "High risk" : order.token.risk === "caution" ? "Risk caution" : "Risk unknown"}: liquidity may be low or the pool may be new. Review token details; you may be unable to sell.</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button autoFocus disabled={busy} onClick={() => dialog.current?.close()} className="h-11 border border-line rounded-md">Cancel</button>
        <button disabled={busy} onClick={() => void buy(order.token, order.amount)} className="min-h-11 px-2 rounded-md bg-buy-fill text-white font-semibold">{busy ? "Submitting…" : "Confirm practice buy"}</button>
      </div>
    </dialog>
  </>;
}
