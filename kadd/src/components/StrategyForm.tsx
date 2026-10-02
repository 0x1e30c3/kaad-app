"use client";
import { useState } from "react";
import { Loader2, Workflow } from "lucide-react";
import type { MarketToken } from "@/lib/market";
import { openLogin, useStore } from "@/lib/store";
import { KIND_LABEL, MIN_TRIGGER_USD, STRATEGIES_READY, createStrategy, type Kind } from "@/lib/strategies";

const sig = (n: number) => Number(n.toPrecision(4));
const EVERY: [number, string][] = [[3600, "1h"], [4 * 3600, "4h"], [86400, "1d"]];
const HELP: Record<Kind, string> = {
  limit: "Buys automatically once the price drops to your target.",
  takeProfit: "Sells your bag automatically once the price rises to your target.",
  stopLoss: "Sells automatically if the price falls to your limit, so a dump can't wipe you out.",
  dca: "Buys a fixed amount on a schedule, so you don't have to time the market.",
};

/** One form for every strategy kind. Funds lock in the strategy contract until it fills or you cancel. */
export default function StrategyForm({ t, kind, held }: { t: MarketToken; kind: Kind; held: number }) {
  const { user } = useStore();
  const [busy, setBusy] = useState(false);
  const [usd, setUsd] = useState("25");
  const [pct, setPct] = useState("100");
  const [price, setPrice] = useState(() => String(sig(t.price * (kind === "limit" ? 0.9 : kind === "takeProfit" ? 1.5 : 0.7))));
  const [runs, setRuns] = useState("5");
  const [every, setEvery] = useState(3600);
  const [cap, setCap] = useState("");

  if (!STRATEGIES_READY)
    return <p className="p-3 rounded-lg bg-raised text-[12px] text-muted">Strategies go live as soon as the contract is deployed on Monad testnet.</p>;
  const tooSmall = t.price < MIN_TRIGGER_USD;
  const p = parseFloat(price);
  const move = p > 0 ? ((p - t.price) / t.price) * 100 : 0;
  const sell = kind === "takeProfit" || kind === "stopLoss";

  const submit = async () => {
    if (!user) return openLogin();
    setBusy(true);
    const ok =
      kind === "dca"
        ? await createStrategy(t, { kind, usdPerRun: parseFloat(usd), runs: parseInt(runs), everySec: every, maxPrice: parseFloat(cap) > 0 ? parseFloat(cap) : null })
        : kind === "limit"
          ? await createStrategy(t, { kind, usd: parseFloat(usd), price: p })
          : await createStrategy(t, { kind, pct: parseFloat(pct), price: p });
    setBusy(false);
    if (ok) setUsd("25");
  };

  const field = "flex items-center gap-2 h-10 px-3 rounded-lg bg-raised border border-transparent focus-within:border-line-strong";
  const input = "flex-1 min-w-0 bg-transparent outline-none font-semibold tabular-nums";
  const invalid =
    tooSmall && kind !== "dca"
      ? true
      : kind === "dca"
        ? !(parseFloat(usd) > 0 && parseInt(runs) > 0)
        : !(p > 0) || (kind === "limit" && !(parseFloat(usd) > 0)) || (sell && (!(parseFloat(pct) > 0) || held === 0)) || (kind === "limit" && p >= t.price) || (kind === "takeProfit" && p <= t.price) || (kind === "stopLoss" && p >= t.price);

  return (
    <div className="flex flex-col gap-2.5 text-[12px]">
      <p className="text-muted">{HELP[kind]}</p>

      {(kind === "limit" || kind === "dca") && (
        <label className={field}>
          <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="Amount" className={input} />
          <span className="text-muted">{kind === "dca" ? "tUSDC / run" : "tUSDC"}</span>
        </label>
      )}
      {sell && (
        <>
          <label className={field}>
            <input value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="Share of holdings" className={input} />
            <span className="text-muted">% of {t.symbol}</span>
          </label>
          <span className="text-muted tabular-nums">You hold {held.toLocaleString("en-US", { maximumFractionDigits: 2 })} {t.symbol}</span>
        </>
      )}
      {kind !== "dca" ? (
        <>
          <label className={field}>
            <span className="text-muted">{kind === "limit" ? "Buy at" : kind === "takeProfit" ? "Sell at" : "Sell if ≤"} $</span>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="Trigger price" className={input} />
          </label>
          <div className="flex justify-between text-muted tabular-nums">
            <span>Now ${sig(t.price)}</span>
            <span className={move >= 0 ? "text-up" : "text-down"}>{move >= 0 ? "+" : ""}{move.toFixed(1)}% from now</span>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <label className={field}>
              <input value={runs} onChange={(e) => setRuns(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Number of buys" className={input} />
              <span className="text-muted">buys</span>
            </label>
            <div className="grid grid-cols-3 p-0.5 rounded-lg bg-raised font-semibold">
              {EVERY.map(([s, l]) => (
                <button key={s} onClick={() => setEvery(s)} className={`rounded-md ${every === s ? "bg-panel shadow-sm" : "text-muted"}`}>{l}</button>
              ))}
            </div>
          </div>
          <label className={field}>
            <span className="text-muted">Only below $</span>
            <input value={cap} onChange={(e) => setCap(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="any price" aria-label="Maximum price" className={`${input} placeholder:text-faint placeholder:font-normal`} />
          </label>
          <span className="text-muted tabular-nums">
            Total {((parseFloat(usd) || 0) * (parseInt(runs) || 0)).toLocaleString("en-US")} tUSDC, first buy right away.
          </span>
        </>
      )}
      {tooSmall && kind !== "dca" && <p className="text-warn">This token&apos;s price is too small for price triggers on testnet.</p>}

      <button onClick={submit} disabled={busy || (!!user && invalid)} className={`h-11 rounded-lg inline-flex items-center justify-center gap-1.5 font-semibold text-[14px] text-white disabled:opacity-40 ${sell ? "bg-down" : "bg-up"}`}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Workflow className="size-4" />}
        {!user ? "Sign in to trade" : busy ? "Confirming onchain…" : `Place ${KIND_LABEL[kind].toLowerCase()}`}
      </button>
      <p className="text-faint text-[11px]">Funds lock in the strategy contract until it fills; cancel anytime to get the rest back.</p>
    </div>
  );
}
