"use client";
import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { Droplets, ExternalLink, FlaskConical, Loader2, OctagonAlert, Zap } from "lucide-react";
import { num } from "@/lib/mock";
import type { MarketToken } from "@/lib/market";
import type { RiskAnalysis } from "@/lib/risk";
import { LEVEL } from "./RiskPanel";
import FundsBadge from "./FundsBadge";
import StrategyForm from "./StrategyForm";
import StrategiesList from "./StrategiesList";
import KuruTrade from "./KuruTrade";
import type { Kind } from "@/lib/strategies";
import { openLogin, useStore } from "@/lib/store";
import { buyToken, faucet, sellToken, useWallet } from "@/lib/swap";
import { EXPLORER, USDC_DECIMALS, VENUE_READY, marketFor, quote, type Market } from "@/lib/venue";

const PRESETS = { buy: ["10", "25", "50", "100"], sell: ["25", "50", "75", "100"] };

/** Practice on Kadd testnet (free test USDC, mainnet prices) or trade live on Monad mainnet through Kuru. */
export default function TradePanel({ t }: { t: MarketToken & { analysis?: RiskAnalysis } }) {
  const [net, setNet] = useState<"testnet" | "mainnet">("testnet");
  return (
    <div className="flex flex-col">
      <div className="px-3 pt-3">
        <div role="tablist" aria-label="Network" className="grid grid-cols-2 p-0.5 rounded-lg bg-raised text-[12px] font-semibold">
          <button role="tab" aria-selected={net === "testnet"} onClick={() => setNet("testnet")} className={`h-8 rounded-md ${net === "testnet" ? "bg-panel shadow-sm text-fg" : "text-muted hover:text-fg"}`}>
            Practice · testnet
          </button>
          <button role="tab" aria-selected={net === "mainnet"} onClick={() => setNet("mainnet")} className={`h-8 rounded-md ${net === "mainnet" ? "bg-panel shadow-sm text-fg" : "text-muted hover:text-fg"}`}>
            Real funds · Kuru
          </button>
        </div>
      </div>
      <p className="px-3 pt-2 text-[11px] text-muted">{net === "testnet" ? "Practice · free test tokens on Monad testnet." : "Real funds · execution on Monad mainnet."} Chart and market data: Monad mainnet.</p>
      {net === "testnet" ? <TestnetTrade t={t} /> : <KuruTrade token={t.address as `0x${string}`} symbol={t.symbol} />}
    </div>
  );
}

function TestnetTrade({ t }: { t: MarketToken & { analysis?: RiskAnalysis } }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"trade" | "faucet" | null>(null);
  const [warned, setWarned] = useState(false); // high-risk buys need an explicit second confirm
  const [mode, setMode] = useState<"market" | Kind>("market");
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
    marketFor(t.address).then(
      (m) => live && setMarket({ key: marketKey, m }),
      (e) => console.warn("[kadd] testnet pool lookup failed", e),
    );
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

  const risky = buy && (t.analysis?.level === "high" || t.analysis?.level === "critical");
  const submit = async () => {
    if (!user) return openLogin();
    if (risky && !warned) return setWarned(true);
    setWarned(false);
    setBusy("trade");
    const ok = buy ? await buyToken(t, n) : await sellToken(t, n);
    setBusy(null);
    if (ok) setAmount("");
  };

  const modes: ["market" | Kind, string][] = [["market", "Market"], ["limit", "Limit"], ["takeProfit", "TP"], ["stopLoss", "SL"], ["dca", "DCA"]];
  const modeTabs = (
    <div role="tablist" aria-label="Order type" className="flex gap-1 text-[12px] font-medium">
      {modes.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`h-7 px-2.5 rounded-md ${mode === k ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}>
          {label}
        </button>
      ))}
    </div>
  );

  if (mode !== "market")
    return (
      <div className="flex flex-col">
        <div className="flex flex-col gap-3 p-3">
          {modeTabs}
          <p className="flex items-center gap-1.5 text-[11px] text-muted"><FundsBadge /> Orders use free test tokens</p>
          <StrategyForm key={mode} t={t} kind={mode} held={held} />
        </div>
        <StrategiesList source={t.address} compact />
      </div>
    );

  return (
    <div className="flex flex-col gap-3 p-3">
      {modeTabs}
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
        <span className="flex items-center gap-1.5"><FundsBadge /> Balance · testnet</span>
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
          <dd className="tabular-nums">{m ? `$${m.price.toLocaleString("en-US", { maximumSignificantDigits: 4 })}` : m === null ? "Opens at mainnet price" : VENUE_READY ? <Loader2 className="inline size-3 animate-spin" /> : "–"}</dd>
        </div>
      </dl>

      {warned && t.analysis && (
        <div role="alert" className="flex flex-col gap-2 p-2.5 rounded-lg border border-down/40 bg-down/5 text-[12px]">
          <div className={`flex items-center gap-1.5 font-semibold ${LEVEL[t.analysis.level].text}`}>
            <OctagonAlert className="size-4" /> {LEVEL[t.analysis.level].label}: are you sure?
          </div>
          <p className="text-muted">{t.analysis.factors.find((f) => f.severity !== "good")?.detail}</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => setWarned(false)} className="h-8 rounded-md border border-line-strong font-semibold hover:bg-hover">Cancel</button>
            <button onClick={submit} className="h-8 rounded-md bg-sell-fill text-white font-semibold">Buy anyway</button>
          </div>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted"><FundsBadge /> Monad testnet · no real monetary value</p>
      <button
        onClick={submit}
        disabled={!VENUE_READY || (!!user && !n) || !!busy || warned}
        className={`h-11 rounded-lg inline-flex items-center justify-center gap-1.5 font-semibold text-[14px] text-white disabled:opacity-40 disabled:cursor-not-allowed ${buy ? "bg-buy-fill" : "bg-sell-fill"}`}
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
