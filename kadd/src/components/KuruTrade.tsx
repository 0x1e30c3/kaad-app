"use client";
import { useEffect, useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { ArrowUpRight, Loader2, ShieldAlert, Zap } from "lucide-react";
import { MON, SCAN, mainnetBalances, quoteKuru, swapOnKuru } from "@/lib/mainnet";
import { openLogin, useStore } from "@/lib/store";
import { short } from "@/lib/mock";
import CopyAddress from "./CopyAddress";

const PRESETS = { buy: ["0.5", "1", "5", "10"], sell: ["25", "50", "75", "100"] };
// Quotes before sign-in use a neutral address: estimates only, nothing can be sent from it.
const GUEST = "0x000000000000000000000000000000000000dEaD";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 5 });

/**
 * Live trading on Monad mainnet: the same passkey account, routed through Kuru's onchain order books by Kuru Flow.
 * Real funds, so a swap always goes through a review step with a fresh quote and its guaranteed minimum.
 */
export default function KuruTrade({ token, symbol }: { token: Address; symbol: string }) {
  const { user } = useStore();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [bal, setBal] = useState<{ mon: bigint; token: bigint; decimals: number } | null>(null);
  const [q, setQ] = useState<{ key: string; out: bigint; min: bigint } | { key: string; error: string } | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const buy = side === "buy";
  const n = parseFloat(amount) || 0;

  useEffect(() => {
    if (!user) return;
    let live = true;
    mainnetBalances(user.address, token).then((b) => live && setBal(b), () => {});
    return () => {
      live = false;
    };
  }, [user, token, tick]);

  const decimals = bal?.decimals ?? 18;
  const amountIn = !n ? 0n : buy ? parseUnits(n.toFixed(6), 18) : user && bal ? (bal.token * BigInt(Math.round(Math.min(n, 100) * 100))) / 10_000n : 0n;
  const key = `${side}:${amountIn}`;

  // Live quote, debounced (Kuru allows ~1 request/second per user).
  useEffect(() => {
    if (amountIn === 0n) return;
    let live = true;
    const id = setTimeout(() => {
      quoteKuru(user?.address ?? GUEST, buy ? MON : token, buy ? token : MON, amountIn).then(
        (r) => live && setQ({ key, out: BigInt(r.output), min: BigInt(r.minOut) }),
        (e) => live && setQ({ key, error: e.message }),
      );
    }, 700);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [user, token, buy, amountIn, key]);
  const quote = q?.key === key ? q : null;
  const outDec = buy ? decimals : 18;
  const enough = !bal || amountIn === 0n ? true : buy ? bal.mon > amountIn : bal.token >= amountIn;

  const run = async () => {
    setBusy(true);
    const hash = await swapOnKuru(side, token, amountIn, symbol, decimals);
    setBusy(false);
    setReview(false);
    if (hash) {
      setLastHash(hash);
      setAmount("");
      setTick((t) => t + 1);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="flex items-start gap-1.5 p-2 rounded-md bg-down/10 text-down text-[11px]">
        <ShieldAlert className="size-3.5 mt-px shrink-0" />
        Real funds on Monad mainnet. Swaps are routed by Kuru Flow and can lose value; memecoins are extremely risky.
      </p>

      <div className="grid grid-cols-2 p-0.5 rounded-lg bg-raised text-[13px] font-semibold">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} onClick={() => (setSide(s), setAmount(""), setReview(false))} className={`h-8 rounded-md ${side === s ? `bg-panel shadow-sm ${s === "buy" ? "text-up" : "text-down"}` : "text-muted hover:text-fg"}`}>
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Mainnet balance</span>
        <span className="tabular-nums text-fg">{!user ? "–" : !bal ? "…" : buy ? `${fmt(Number(formatUnits(bal.mon, 18)))} MON` : `${fmt(Number(formatUnits(bal.token, decimals)))} ${symbol}`}</span>
      </div>

      <label className="flex items-center gap-2 h-11 px-3 rounded-lg bg-raised border border-transparent focus-within:border-line-strong">
        <input value={amount} onChange={(e) => (setAmount(e.target.value.replace(/[^\d.]/g, "")), setReview(false))} placeholder="0.00" inputMode="decimal" aria-label="Amount" className="flex-1 min-w-0 bg-transparent outline-none text-[16px] font-semibold tabular-nums placeholder:text-faint" />
        <span className="text-muted font-medium">{buy ? "MON" : "%"}</span>
      </label>
      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS[side].map((p) => (
          <button key={p} onClick={() => (setAmount(p), setReview(false))} className={`h-7 rounded-md border text-[12px] font-medium tabular-nums ${amount === p ? "border-fg/50 text-fg" : "border-line text-muted hover:text-fg hover:border-line-strong"}`}>
            {buy ? p : `${p}%`}
          </button>
        ))}
      </div>

      <dl className="flex flex-col gap-1.5 text-[12px] tabular-nums">
        <div className="flex justify-between">
          <dt className="text-muted">You receive (est.)</dt>
          <dd>{!amountIn ? "–" : !quote ? <Loader2 className="inline size-3 animate-spin" /> : "error" in quote ? <span className="text-down">{quote.error}</span> : `${fmt(Number(formatUnits(quote.out, outDec)))} ${buy ? symbol : "MON"}`}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Minimum (after slippage)</dt>
          <dd>{quote && !("error" in quote) ? `${fmt(Number(formatUnits(quote.min, outDec)))} ${buy ? symbol : "MON"}` : "–"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Route</dt>
          <dd>Kuru Flow · Monad mainnet</dd>
        </div>
      </dl>

      {user && !enough && (
        <div className="flex flex-col gap-1 p-2.5 rounded-lg border border-line text-[12px]">
          <span className="font-medium">Not enough {buy ? "MON" : symbol} on mainnet.</span>
          <span className="text-muted">Send MON on Monad mainnet to your Kadd address (also covers gas):</span>
          <CopyAddress address={user!.address} />
        </div>
      )}

      {!user ? (
        <button onClick={() => openLogin()} className="h-11 rounded-lg bg-fg text-bg font-semibold">Sign in to trade on mainnet</button>
      ) : review && quote && !("error" in quote) ? (
        <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-line-strong text-[12px]">
          <span className="font-semibold">
            {buy ? `Spend ${amount} MON` : `Sell ${amount}% of your ${symbol}`} for at least {fmt(Number(formatUnits(quote.min, outDec)))} {buy ? symbol : "MON"}?
          </span>
          <span className="text-muted">Signed by your passkey session on Monad mainnet. A fresh quote is taken right before sending.</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => setReview(false)} disabled={busy} className="h-9 rounded-md border border-line-strong font-semibold hover:bg-hover">Cancel</button>
            <button onClick={run} disabled={busy} className={`h-9 rounded-md font-semibold text-white inline-flex items-center justify-center gap-1.5 ${buy ? "bg-up" : "bg-down"}`}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4 fill-current" />} {busy ? "Swapping…" : "Confirm swap"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setReview(true)}
          disabled={!amountIn || !quote || "error" in quote || !enough}
          className={`h-11 rounded-lg inline-flex items-center justify-center gap-1.5 font-semibold text-[14px] text-white disabled:opacity-40 disabled:cursor-not-allowed ${buy ? "bg-up" : "bg-down"}`}
        >
          Review {buy ? "buy" : "sell"} on mainnet
        </button>
      )}

      {lastHash && (
        <a href={`${SCAN}/tx/${lastHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg">
          Last mainnet swap {short(lastHash)} <ArrowUpRight className="size-3" />
        </a>
      )}
    </div>
  );
}
