"use client";
import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import type { TokenRef } from "@/lib/market";
import { buyToken } from "@/lib/swap";

/** One-click onchain buy of `usd` tUSDC (Monad testnet). Shows a spinner while the transactions confirm. */
export default function QuickBuy({ t, usd, className, label }: { t: TokenRef & { price: number }; usd: number; className: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await buyToken(t, usd);
        setBusy(false);
      }}
      disabled={busy}
      title={`Buy ${usd} tUSDC of ${t.symbol} on Monad testnet`}
      className={`${className} disabled:opacity-60`}
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3 fill-current" />}
      {label ?? usd}
    </button>
  );
}
