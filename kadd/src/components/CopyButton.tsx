"use client";
import { useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { buyToken, sellToken } from "@/lib/swap";
import { useStore } from "@/lib/store";

type Token = { address: string; symbol: string; image: string | null; price: number };

/**
 * One-tap copy of someone's mainnet trade on Kadd testnet: a buy spends your copy size in tUSDC on the same token's
 * mirror pool; a sell exits your whole position in it (we can't know what share of theirs they sold).
 */
export default function CopyButton({ side, token }: { side: "buy" | "sell"; token: Token }) {
  const { copySize } = useStore();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const t = { ...token, name: token.symbol };
    await (side === "buy" ? buyToken(t, copySize) : sellToken(t, 100));
    setBusy(false);
  };
  return (
    <button
      onClick={run}
      disabled={busy}
      title={side === "buy" ? `Buy ${copySize} tUSDC of ${token.symbol} on Kadd testnet` : `Sell all your ${token.symbol} on Kadd testnet`}
      className="relative z-10 h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-line-strong text-[12px] font-semibold hover:bg-hover disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Copy className="size-3" />}
      {side === "buy" ? `Copy $${copySize}` : "Copy exit"}
    </button>
  );
}
