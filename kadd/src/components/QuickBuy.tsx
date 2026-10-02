"use client";
import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import type { TokenRef } from "@/lib/market";
import type { Risk } from "@/lib/mock";
import { buyToken } from "@/lib/swap";

/** One-click onchain buy of `usd` tUSDC (Monad testnet). Shows a spinner while the transactions confirm. */
export default function QuickBuy({ t, usd, className, label }: { t: TokenRef & { price: number; risk?: Risk }; usd: number; className: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false); // high-risk tokens take a second click
  return (
    <button
      onClick={async () => {
        if (t.risk === "danger" && !confirm) {
          setConfirm(true);
          setTimeout(() => setConfirm(false), 4000);
          return;
        }
        setConfirm(false);
        setBusy(true);
        await buyToken(t, usd);
        setBusy(false);
      }}
      disabled={busy}
      title={confirm ? "High risk token — click again to buy" : `Buy ${usd} tUSDC of ${t.symbol} on Monad testnet`}
      className={`${className} disabled:opacity-60 ${confirm ? "!bg-down !text-white !border-down" : ""}`}
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3 fill-current" />}
      {confirm ? "Sure?" : (label ?? usd)}
    </button>
  );
}
