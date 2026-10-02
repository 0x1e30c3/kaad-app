"use client";
import { useState } from "react";
import { FlaskConical, Zap } from "lucide-react";
import { num } from "@/lib/mock";
import type { MarketToken } from "@/lib/market";
import { openLogin, trade, useStore } from "@/lib/store";
const PRESETS = { buy: ["10", "25", "50", "100"], sell: ["25", "50", "75", "100"] };

export default function TradePanel({ t }: { t: MarketToken }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const { user, balance, positions } = useStore();
  const pos = positions.find((p) => p.address === t.address);
  const buy = side === "buy";
  const n = parseFloat(amount) || 0;
  const receive = buy ? n / t.price : 0;
  const impact = buy ? Math.min((n / Math.max(t.liq, 1)) * 100, 99) : 0;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-2 p-0.5 rounded-lg bg-raised text-[13px] font-semibold">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setAmount("");
            }}
            className={`h-8 rounded-md ${side === s ? `bg-panel shadow-sm ${s === "buy" ? "text-up" : "text-down"}` : "text-muted hover:text-fg"}`}
          >
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Demo balance</span>
        <span className="tabular-nums text-fg">{!user ? "–" : buy ? `${balance.toFixed(2)} USDC` : `${num(pos?.amount ?? 0)} ${t.symbol}`}</span>
      </div>

      <label className="flex items-center gap-2 h-11 px-3 rounded-lg bg-raised border border-transparent focus-within:border-line-strong">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0.00"
          inputMode="decimal"
          aria-label="Amount"
          className="flex-1 min-w-0 bg-transparent outline-none text-[16px] font-semibold tabular-nums placeholder:text-faint"
        />
        <span className="text-muted font-medium">{buy ? "USDC" : "%"}</span>
      </label>

      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS[side].map((p) => (
          <button
            key={p}
            onClick={() => setAmount(p)}
            className={`h-7 rounded-md border text-[12px] font-medium tabular-nums ${amount === p ? "border-fg/50 text-fg" : "border-line text-muted hover:text-fg hover:border-line-strong"}`}
          >
            {buy ? p : `${p}%`}
          </button>
        ))}
      </div>

      <dl className="flex flex-col gap-1.5 text-[12px]">
        {buy && (
          <div className="flex justify-between">
            <dt className="text-muted">You receive (est.)</dt>
            <dd className="tabular-nums">{n ? `${num(receive)} ${t.symbol}` : "–"}</dd>
          </div>
        )}
        {buy && (
          <div className="flex justify-between">
            <dt className="text-muted">Price impact</dt>
            <dd className={`tabular-nums ${impact > 5 ? "text-down" : impact > 1 ? "text-warn" : ""}`}>{n ? `${impact.toFixed(2)}%` : "–"}</dd>
          </div>
        )}
      </dl>

      <button
        onClick={() => (user ? trade(t, side, n) && setAmount("") : openLogin())}
        disabled={!!user && !n}
        className={`h-11 rounded-lg inline-flex items-center justify-center gap-1.5 font-semibold text-[14px] text-white disabled:opacity-40 disabled:cursor-not-allowed ${buy ? "bg-up" : "bg-down"}`}
      >
        <Zap className="size-4 fill-current" />
        {!user ? "Sign in to trade" : buy ? `Buy ${t.symbol}` : `Sell ${t.symbol}`}
      </button>
      <p className="flex items-start gap-1.5 p-2 rounded-md bg-warn/10 text-warn text-[11px]">
        <FlaskConical className="size-3.5 mt-px shrink-0" />
        Demo mode: prices are live from Monad mainnet, but orders only move your demo balance in this browser. Onchain trading lives in Clubs (testnet).
      </p>
    </div>
  );
}
