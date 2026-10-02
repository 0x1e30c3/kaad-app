"use client";
import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { Droplets, ExternalLink, FlaskConical, Loader2, Zap } from "lucide-react";
import { num } from "@/lib/mock";
import type { MarketToken } from "@/lib/market";
import { openLogin, useStore } from "@/lib/store";
import { buyToken, faucet, sellToken, useWallet } from "@/lib/swap";
import { EXPLORER, USDC_DECIMALS, VENUE_READY, marketFor, quote, type Market } from "@/lib/venue";

const PRESETS = { buy: ["10", "25", "50", "100"], sell: ["25", "50", "75", "100"] };

export default function TradePanel({ t }: { t: MarketToken }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"trade" | "faucet" | null>(null);
  const { user, rev, fills } = useStore();
  const wallet = useWallet();
  const [market, setMarket] = useState<{ key: string; m: Market | null } | null>(null);
  const [est, setEst] = useState<{ key: string; out: bigint } | null>(null);
  const buy = side === "buy";
  const n = parseFloat(amount) || 0;
  const held = wallet?.holdings.find((h) => h.market.source.toLowerCase() === t.address)?.amount ?? 0;
  const lastTx = fills.find((f) => f.address === t.address);

  // The token's testnet pool (null = not opened yet); re-checked after each trade.
  const marketKey = `${t.address}:${rev}`;
  useEffect(() => {
    if (!VENUE_READY) return;
    let live = true;
    marketFor(t.address).then((m) => live && setMarket({ key: marketKey, m }), () => {});
    return () => {
      live = false;
    };
  }, [t.address, marketKey]);
  const m = market?.key === marketKey ? market.m : undefined;

  // Quote from the pool; before a pool exists, estimate from the mainnet price it would open at.
  const estKey = `${m?.address}:${side}:${amount}`;
  useEffect(() => {
    if (!m || !n) return;
    let live = true;
    const amountIn = buy ? parseUnits(n.toFixed(6), USDC_DECIMALS) : parseUnits(((held * Math.min(n, 100)) / 100).toFixed(18), 18);
    const id = setTimeout(() => quote(m, buy, amountIn).then((out) => live && setEst({ key: estKey, out }), () => {}), 250);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [m, n, buy, held, estKey]);
  const receive = !n ? null : m ? (est?.key === estKey ? Number(formatUnits(est.out, buy ? 18 : USDC_DECIMALS)) : undefined) : buy ? (n / t.price) * 0.997 : null;

  const submit = async () => {
    if (!user) return openLogin();
    setBusy("trade");
    const ok = buy ? await buyToken(t, n) : await sellToken(t, n);
    setBusy(null);
    if (ok) setAmount("");
  };

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
        <span>Balance</span>
        <span className="tabular-nums text-fg">
          {!user ? "–" : !wallet ? "…" : buy ? `${num(wallet.usdc)} tUSDC` : `${num(held)} ${t.symbol}`}
        </span>
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
        <span className="text-muted font-medium">{buy ? "tUSDC" : "%"}</span>
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
        <div className="flex justify-between">
          <dt className="text-muted">You receive (est.)</dt>
          <dd className="tabular-nums">
            {receive === null ? "–" : receive === undefined ? <Loader2 className="inline size-3 animate-spin" /> : `${num(receive)} ${buy ? t.symbol : "tUSDC"}`}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Testnet pool price</dt>
          <dd className="tabular-nums">{m ? `$${m.price.toLocaleString("en-US", { maximumSignificantDigits: 4 })}` : m === null ? "Opens at mainnet price" : "–"}</dd>
        </div>
      </dl>

      <button
        onClick={submit}
        disabled={!VENUE_READY || (!!user && !n) || !!busy}
        className={`h-11 rounded-lg inline-flex items-center justify-center gap-1.5 font-semibold text-[14px] text-white disabled:opacity-40 disabled:cursor-not-allowed ${buy ? "bg-up" : "bg-down"}`}
      >
        {busy === "trade" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4 fill-current" />}
        {!user ? "Sign in to trade" : busy === "trade" ? "Confirming onchain…" : buy ? `Buy ${t.symbol}` : `Sell ${t.symbol}`}
      </button>

      {user && wallet && wallet.usdc < 100 && buy && (
        <button
          onClick={async () => {
            setBusy("faucet");
            await faucet();
            setBusy(null);
          }}
          disabled={!!busy}
          className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-line-strong text-[12px] font-semibold hover:bg-hover disabled:opacity-40"
        >
          {busy === "faucet" ? <Loader2 className="size-3.5 animate-spin" /> : <Droplets className="size-3.5" />} Get 1,000 free test USDC
        </button>
      )}

      {lastTx && (
        <a href={`${EXPLORER}/tx/${lastTx.hash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg">
          Last trade: {lastTx.side === "buy" ? "bought" : "sold"} {num(lastTx.amount)} {t.symbol} <ExternalLink className="size-3" />
        </a>
      )}

      <p className="flex items-start gap-1.5 p-2 rounded-md bg-warn/10 text-warn text-[11px]">
        <FlaskConical className="size-3.5 mt-px shrink-0" />
        {VENUE_READY
          ? m === null
            ? `Monad testnet: ${t.symbol} has no testnet pool yet. Your first trade opens one at the mainnet price (one extra transaction). Test tokens only, no real value.`
            : `Monad testnet: you trade a testnet mirror of ${t.symbol} with free test USDC. Real transactions, no real value. Chart & stats are mainnet.`
          : "Testnet trading isn't configured yet."}
      </p>
    </div>
  );
}
