"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits, parseUnits, type Address } from "viem";
import { ArrowLeft, CircleAlert, Crown, ExternalLink, Hourglass, Landmark, Loader2, Lock, Unlock } from "lucide-react";
import { ClubNotFound, claim, depositUsdc, getClub, quoteSwap, redeem, trade, txError, type ClubDetail as Club } from "@/lib/club";
import { USDC_DECIMALS, type Market } from "@/lib/kuru";
import { requireAccount, toast, useStore } from "@/lib/store";
import { useAsync } from "@/lib/useAsync";
import { chain } from "@/lib/wallet";
import { short } from "@/lib/mock";

const fmt = (v: bigint, d: number, max = 4) => Number(formatUnits(v, d)).toLocaleString("en-US", { maximumFractionDigits: max });
const card = "rounded-lg border border-line bg-panel";

/** Wraps a write: ensures a signing session, shows progress, toasts the outcome, refreshes data. */
function useTx(reload: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  /** Resolves true only when the transaction succeeded, so callers can clear inputs on success only. */
  const run = async (key: string, fn: () => Promise<unknown>, ok: string): Promise<boolean> => {
    setBusy(key);
    try {
      if (!(await requireAccount())) return false;
      await fn();
      toast(ok);
      reload();
      return true;
    } catch (e) {
      toast(txError(e), "err");
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

function Deposit({ club, run, busy }: { club: Club; run: ReturnType<typeof useTx>["run"]; busy: string | null }) {
  const [amount, setAmount] = useState("");
  const value = (() => {
    try {
      return parseUnits(amount || "0", USDC_DECIMALS);
    } catch {
      return 0n;
    }
  })();
  const tooMuch = value > club.walletUsdc;

  return (
    <section className={`${card} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Deposit USDC</h3>
        <span className="text-[12px] text-muted tabular-nums">Balance {fmt(club.walletUsdc, USDC_DECIMALS, 2)} USDC</span>
      </div>
      {!club.flat && (
        <p className="flex gap-2 p-2.5 rounded-md bg-warn/10 text-warn text-[12px]">
          <Lock className="size-3.5 mt-px shrink-0" /> The club is holding positions. Deposits reopen once the captain closes them all.
        </p>
      )}
      <div className="flex gap-2">
        <label className={`flex-1 flex items-center h-10 px-3 rounded-md bg-raised border ${tooMuch ? "border-down/60" : "border-transparent focus-within:border-line-strong"}`}>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0.00" aria-label="USDC amount" className="flex-1 min-w-0 bg-transparent outline-none tabular-nums font-semibold" />
          <button type="button" onClick={() => setAmount(formatUnits(club.walletUsdc, USDC_DECIMALS))} className="text-[11px] text-muted hover:text-fg">MAX</button>
        </label>
        <button
          disabled={!club.flat || !value || tooMuch || !!busy}
          onClick={() => run("deposit", () => depositUsdc(club.address, value), `Deposited ${amount} USDC`).then((ok) => ok && setAmount(""))}
          className="h-10 px-4 rounded-md bg-fg text-bg font-semibold inline-flex items-center gap-2 disabled:opacity-40"
        >
          {busy === "deposit" && <Loader2 className="size-4 animate-spin" />} Deposit
        </button>
      </div>
      {tooMuch && <p className="text-[12px] text-down">More than your USDC balance.</p>}
      {club.walletUsdc === 0n && (
        <p className="text-[11px] text-faint">Kuru testnet USDC can only be minted by the Kuru team. Contact them for test tokens.</p>
      )}
    </section>
  );
}

function Redeem({ club, run, busy }: { club: Club; run: ReturnType<typeof useTx>["run"]; busy: string | null }) {
  if (club.myShares === 0n) return null;
  const pct = Number((club.myShares * 10_000n) / club.totalShares) / 100;
  return (
    <section className={`${card} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Withdraw your share</h3>
        <span className="text-[12px] text-muted tabular-nums">{pct.toLocaleString("en-US")}% of club</span>
      </div>
      <p className="text-[12px] text-muted">You get the same share of every asset in the club (USDC and positions), straight to your wallet. Always available, no captain approval needed. If a token can’t be sent, that part is recorded and can be claimed later.</p>
      <div className="grid grid-cols-4 gap-1.5">
        {[25, 50, 75, 100].map((p) => (
          <button
            key={p}
            disabled={!!busy}
            onClick={() => run(`redeem${p}`, () => redeem(club.address, (club.myShares * BigInt(p)) / 100n), `Withdrew ${p}%`)}
            className="h-9 rounded-md border border-line-strong font-semibold text-[12px] hover:bg-hover disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
          >
            {busy === `redeem${p}` && <Loader2 className="size-3.5 animate-spin" />}
            {p}%
          </button>
        ))}
      </div>
    </section>
  );
}

function CaptainPanel({ club, run, busy }: { club: Club; run: ReturnType<typeof useTx>["run"]; busy: string | null }) {
  const [market, setMarket] = useState<Market>(club.positions[0].market);
  const [isBuy, setIsBuy] = useState(true);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<{ key: string; out: bigint } | null>(null);
  const decimalsIn = isBuy ? USDC_DECIMALS : market.decimals;
  const amountIn = (() => {
    try {
      return parseUnits(amount || "0", decimalsIn);
    } catch {
      return 0n;
    }
  })();
  const cap = (club.usdc * BigInt(club.maxTradeBps)) / 10_000n;
  const position = club.positions.find((p) => p.market.address === market.address)?.balance ?? 0n;

  const quoteKey = `${market.address}:${isBuy}:${amountIn}`;

  useEffect(() => {
    if (!amountIn) return;
    let live = true;
    const t = setTimeout(
      () => quoteSwap(market, isBuy, amountIn).then((out) => live && setQuote({ key: quoteKey, out }), () => live && setQuote({ key: quoteKey, out: 0n })),
      300,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [market, isBuy, amountIn, quoteKey]);

  // Only show a quote that matches the current inputs; otherwise we're still fetching.
  const shownQuote = amountIn && quote?.key === quoteKey ? quote.out : null;

  return (
    <section className={`${card} p-4 flex flex-col gap-3 border-brand/40`}>
      <div className="flex items-center gap-2">
        <Crown className="size-4 text-warn" />
        <h3 className="font-semibold">Captain panel</h3>
        <span className="ml-auto text-[11px] text-muted tabular-nums">Buy limit {fmt(cap, USDC_DECIMALS, 2)} USDC</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {club.positions.map((p) => (
          <button key={p.market.address} onClick={() => setMarket(p.market)} className={`h-8 px-3 rounded-md border text-[12px] font-medium ${market.address === p.market.address ? "border-fg/50 text-fg" : "border-line text-muted"}`}>
            {p.market.symbol}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 p-0.5 rounded-lg bg-raised text-[13px] font-semibold">
        {[true, false].map((b) => (
          <button key={String(b)} onClick={() => (setIsBuy(b), setAmount(""))} className={`h-8 rounded-md ${isBuy === b ? `bg-panel shadow-sm ${b ? "text-up" : "text-down"}` : "text-muted"}`}>
            {b ? "Buy" : "Sell"} {market.symbol}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 h-10 px-3 rounded-md bg-raised border border-transparent focus-within:border-line-strong">
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0.00" aria-label="Amount" className="flex-1 min-w-0 bg-transparent outline-none tabular-nums font-semibold" />
        <span className="text-muted text-[12px]">{isBuy ? "USDC" : market.symbol}</span>
        {!isBuy && <button type="button" onClick={() => setAmount(formatUnits(position, market.decimals))} className="text-[11px] text-muted hover:text-fg">MAX</button>}
      </label>
      <div className="flex justify-between text-[12px]">
        <span className="text-muted">Est. received</span>
        <span className="tabular-nums">
          {!amountIn ? "–" : shownQuote === null ? <Loader2 className="inline size-3.5 animate-spin text-muted" /> : shownQuote === 0n ? <span className="text-down">No liquidity</span> : `${fmt(shownQuote, isBuy ? market.decimals : USDC_DECIMALS)} ${isBuy ? market.symbol : "USDC"}`}
        </span>
      </div>
      <button
        disabled={!amountIn || !shownQuote || !!busy}
        onClick={() => run("trade", () => trade(club.address, market, isBuy, amountIn, 100), `${isBuy ? "Bought" : "Sold"} ${market.symbol}`).then((ok) => ok && setAmount(""))}
        className={`h-10 rounded-md font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-40 ${isBuy ? "bg-up" : "bg-down"}`}
      >
        {busy === "trade" && <Loader2 className="size-4 animate-spin" />}
        Execute on Kuru · 1% slippage
      </button>
    </section>
  );
}

export default function ClubDetail({ address }: { address: Address }) {
  const { user } = useStore();
  const { data: club, error, loading, reload } = useAsync(() => getClub(address, user?.address), [address, user?.address]);
  const { busy, run } = useTx(reload);

  if (loading && !club) return <div className="h-64 grid place-items-center text-muted"><Loader2 className="size-6 animate-spin" /></div>;
  if (error || !club)
    return (
      <div className="p-10 flex flex-col items-center gap-3 text-center text-muted">
        <p>{error instanceof ClubNotFound ? "Club not found onchain." : "Couldn't load club from Monad testnet."}</p>
        <div className="flex gap-2">
          {!(error instanceof ClubNotFound) && (
            <button onClick={reload} className="h-8 px-3 rounded-md bg-fg text-bg text-[12px] font-semibold">Try again</button>
          )}
          <Link href="/groups" className="h-8 px-3 grid place-items-center rounded-md border border-line-strong text-[12px] font-semibold text-fg">Back</Link>
        </div>
      </div>
    );

  const isCaptain = !!user && club.captain.toLowerCase() === user.address.toLowerCase();
  const explorer = `${chain.blockExplorers?.default.url}/address/${club.address}`;

  return (
    <div className="p-3 md:p-5 max-w-6xl mx-auto flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/groups" aria-label="Back" className="grid place-items-center size-8 rounded-md text-muted hover:text-fg hover:bg-hover"><ArrowLeft className="size-4" /></Link>
        <div className="grid place-items-center size-11 rounded-lg bg-raised"><Landmark className="size-5" /></div>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{club.name}</h1>
          <p className="text-muted text-[12px]">
            Captain <span className="font-mono">{isCaptain ? "you" : short(club.captain)}</span> · buy limit {club.maxTradeBps / 100}% per trade
          </p>
        </div>
        <span className={`ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium ${club.flat ? "bg-up/10 text-up" : "bg-warn/10 text-warn"}`}>
          {club.flat ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
          {club.flat ? "Deposits open" : "Holding positions"}
        </span>
        <a href={explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-line text-[12px] text-muted hover:text-fg">
          <ExternalLink className="size-3.5" /> Contract
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${card} p-4`}>
          <div className="text-[12px] text-muted">USDC in club</div>
          <div className="mt-1 text-[22px] font-semibold tabular-nums">{fmt(club.usdc, USDC_DECIMALS, 2)}</div>
          {!club.flat && <div className="text-[11px] text-muted">+ open positions (see table)</div>}
        </div>
        <div className={`${card} p-4`}>
          <div className="text-[12px] text-muted">Your share</div>
          <div className="mt-1 text-[22px] font-semibold tabular-nums">{club.totalShares ? (Number((club.myShares * 10_000n) / club.totalShares) / 100).toLocaleString("en-US") : 0}%</div>
        </div>
        <div className={`${card} p-4`}>
          <div className="text-[12px] text-muted">Market</div>
          <div className="mt-1 text-[22px] font-semibold">{club.positions.map((p) => p.market.symbol).join(" · ")}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px] items-start">
        <section className={`${card} overflow-hidden`}>
          <h2 className="px-4 h-11 flex items-center font-semibold border-b border-line">Club positions</h2>
          <table className="w-full tabular-nums text-[13px]">
            <thead className="text-[11px] text-muted">
              <tr className="border-b border-line">
                <th className="text-left font-medium px-4 py-2">Market</th>
                <th className="text-right font-medium px-3">Amount</th>
                <th className="text-right font-medium px-3">Bid / Ask Kuru</th>
              </tr>
            </thead>
            <tbody>
              {club.positions.map((p) => (
                <tr key={p.market.address} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{p.market.symbol}<span className="text-muted font-normal">/USDC</span></td>
                  <td className="px-3 text-right">{fmt(p.balance, p.market.decimals)}</td>
                  <td className="px-3 text-right">
                    {p.bid === null && p.ask === null ? <span className="text-faint">Empty book</span> : `${p.bid ?? "–"} / ${p.ask ?? "–"}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {club.positions.every((p) => p.bid === null && p.ask === null) && (
            <p className="flex gap-2 m-3 p-2.5 rounded-md bg-raised text-muted text-[12px]">
              <CircleAlert className="size-3.5 mt-px shrink-0" /> The Kuru testnet order book is empty, so trades can’t execute yet. Deposits and withdrawals still work.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-4">
          {club.owed.length > 0 && (
            <section className={`${card} p-4 flex flex-col gap-3 border-warn/40`}>
              <h3 className="flex items-center gap-2 font-semibold"><Hourglass className="size-4 text-warn" /> Pending withdrawals</h3>
              <p className="text-[12px] text-muted">Part of your withdrawal couldn’t be sent at the time (e.g. a Kuru withdrawal limit). It’s still yours and can be claimed anytime.</p>
              {club.owed.map((o) => (
                <div key={o.token} className="flex items-center justify-between">
                  <span className="tabular-nums font-medium">{fmt(o.amount, o.decimals)} {o.symbol}</span>
                  <button disabled={!!busy} onClick={() => run(`claim${o.token}`, () => claim(club.address, o.token), `Claimed ${o.symbol}`)} className="h-8 px-3 rounded-md border border-line-strong text-[12px] font-semibold hover:bg-hover disabled:opacity-40 inline-flex items-center gap-1.5">
                    {busy === `claim${o.token}` && <Loader2 className="size-3.5 animate-spin" />} Claim
                  </button>
                </div>
              ))}
            </section>
          )}
          {isCaptain && club.positions.length > 0 && <CaptainPanel club={club} run={run} busy={busy} />}
          <Deposit club={club} run={run} busy={busy} />
          <Redeem club={club} run={run} busy={busy} />
        </div>
      </div>
    </div>
  );
}
