"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAsync } from "@/lib/useAsync";
import { swapOnKuru } from "@/lib/mainnet";
import { liquidationPrice, type PerpSide } from "@/lib/perplOrder";
import { AUSD, PERPL_APP, quoteAusd, closePerp, depositAusd, fetchPerpMarkets, myPositions, openPerp, perpAccount, withdrawAusd, type MyPosition, type PerpNet } from "@/lib/perplTrade";
import { Pct, btnSm, card } from "./ui";
import LoginGate from "./LoginGate";
import TelegramConnect from "./TelegramConnect";

const SIZES = [25, 50, 100, 250];
const LEVERAGES = [1, 2, 3, 5, 10];
const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
const px = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 6 });
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
const input = "h-10 min-w-0 px-3 rounded-lg bg-raised outline-none border border-transparent focus:border-line-strong tabular-nums text-[15px]";
const field = `${input} w-full`;
const seg = (on: boolean, tone?: "up" | "down") =>
  `h-10 flex-1 rounded-lg text-[14px] font-semibold ${on ? (tone === "up" ? "bg-buy-fill text-white" : tone === "down" ? "bg-sell-fill text-white" : "bg-fg text-bg") : "bg-raised text-muted"}`;

/**
 * Perps on Perpl from the passkey account: AUSD in and out, a market ticket, open positions. Testnet is free practice
 * with test AUSD; mainnet trades real AUSD (topped up by swapping MON on Kuru).
 */
export default function PerpsTrade() {
  const { user, rev } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const net: PerpNet = params.get("net") === "mainnet" ? "mainnet" : "testnet";
  const me = user?.address;

  const markets = useAsync(() => fetchPerpMarkets(net), [net]);
  const account = useAsync(() => (me ? perpAccount(net, me) : Promise.resolve(null)), [net, me, rev]);
  const acctId = account.data?.accountId ?? 0n;
  const positions = useAsync(() => (acctId && markets.data ? myPositions(net, acctId, markets.data) : Promise.resolve([])), [net, acctId, markets.data, rev]);

  const [marketId, setMarketId] = useState<number | null>(Number(params.get("market")) || null);
  const [side, setSide] = useState<PerpSide>(params.get("side") === "short" ? "short" : "long");
  const [usd, setUsd] = useState("50");
  const [lev, setLev] = useState(Math.max(1, Math.min(10, Number(params.get("lev")) || 2)));
  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState("100");

  const list = markets.data ?? [];
  const m = list.find((x) => x.id === marketId) ?? list.find((x) => x.name === params.get("market")) ?? list[0];

  const setNet = (n: PerpNet) => {
    const q = new URLSearchParams(params);
    q.set("net", n);
    q.delete("market");
    setMarketId(null);
    router.replace(`/perps?${q}`, { scroll: false });
  };

  const size = Number(usd) || 0;
  const leverage = m ? Math.min(lev, m.maxLeverage) : lev;
  const mark = m?.ticker?.mark ?? 0;
  const margin = size / leverage;
  const fee = m ? (size * m.takerFee) / 100_000 : 0;
  const liq = m && mark ? liquidationPrice(side, mark, leverage, m.maintLeverage) : 0;
  const free = account.data?.free ?? 0;
  const canTrade = !!acctId && size > 0 && margin <= free && !!m;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Network" className="flex p-1 rounded-xl bg-raised self-start">
        {(["testnet", "mainnet"] as const).map((n) => (
          <button key={n} role="tab" aria-selected={net === n} onClick={() => setNet(n)} className={`h-8 px-4 rounded-lg text-[13px] font-semibold ${net === n ? "bg-panel text-fg shadow-sm" : "text-muted"}`}>
            {n === "testnet" ? "Practice · testnet" : "Real funds · mainnet"}
          </button>
        ))}
      </div>

      {!user ? (
        <LoginGate title="Trade perps with your passkey" desc="One passkey, no wallet app. Practise free on Perpl testnet, or trade real AUSD on mainnet." />
      ) : (
        <>
          {/* AUSD: wallet ↔ Perpl account */}
          <section className={`${card} p-4 gap-3`}>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="text-[12px] text-muted">{net === "testnet" ? "Practice · test AUSD" : "Real funds · mainnet AUSD"} · Available on Perpl</div>
                <div className="text-[28px] font-semibold tabular-nums tracking-[-0.02em]">{account.data ? `${free.toFixed(2)} AUSD` : "–"}</div>
                <div className="text-[12px] text-muted tabular-nums">
                  {account.data
                    ? `${account.data.wallet.toFixed(2)} AUSD in your wallet${account.data.locked ? ` · ${account.data.locked.toFixed(2)} locked in orders` : ""}`
                    : account.error
                      ? `Couldn’t read Perpl ${net}: ${(account.error as Error).message.split("\n")[0]}`
                      : "Reading balances…"}
                </div>
              </div>
              <button onClick={() => account.reload()} aria-label="Refresh balances" className="size-8 grid place-items-center rounded-md hover:bg-hover text-muted"><RefreshCw className="size-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="AUSD amount" className={`${input} w-full flex-none`} />
              <button
                onClick={() => run("deposit", () => depositAusd(net, Number(amount)))}
                disabled={!!busy || !(Number(amount) > 0)}
                className="h-10 flex-1 min-w-0 px-2 rounded-lg bg-brand-fill text-[#0a0a0a] text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
              >
                {busy === "deposit" ? <Loader2 className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />} {acctId ? "Deposit" : "Open account"}
              </button>
              <button onClick={() => run("withdraw", () => withdrawAusd(net, Number(amount)))} disabled={!!busy || !acctId || !(Number(amount) > 0)} className="h-10 px-3 rounded-lg border border-line-strong text-[14px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40">
                {busy === "withdraw" ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpFromLine className="size-4" />} Withdraw
              </button>
            </div>
            {account.data && !acctId && (
              <p className="text-[12px] text-muted">Your first deposit opens your Perpl account (at least {account.data.minOpen} AUSD). One approval, one transaction, no prompts.</p>
            )}
            {account.data && account.data.wallet < 1 && !free && (
              net === "testnet" ? (
                <p className="text-[12px] text-muted">
                  Need test AUSD? Get it on <a href={PERPL_APP.testnet} target="_blank" rel="noreferrer" className="text-fg underline">Perpl testnet</a> and send it to your Kadd address, then deposit here.
                </p>
              ) : (
                <GetAusd busy={busy} run={run} />
              )
            )}
          </section>

          {/* Ticket */}
          <section className={`${card} p-4 gap-4`}>
            <div className="-mx-1 px-1 flex gap-2 overflow-x-auto">
              {list.map((x) => (
                <button key={x.id} onClick={() => setMarketId(x.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-left ${x.id === m?.id ? "border-fg" : "border-line hover:border-line-strong"}`}>
                  <div className="text-[13px] font-semibold">{x.name}</div>
                  <div className="text-[12px] tabular-nums text-muted">
                    {x.ticker ? <>{px(x.ticker.mark)} <Pct v={((x.ticker.mark - x.ticker.prev) / x.ticker.prev) * 100} className="text-[11px]" /></> : "–"}
                  </div>
                </button>
              ))}
              {markets.loading && !list.length && <span className="text-[13px] text-muted py-3">Loading Perpl markets…</span>}
              {markets.error ? <span className="text-[13px] text-muted py-3">Couldn’t reach Perpl. <button onClick={markets.reload} className="underline">Retry</button></span> : null}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setSide("long")} className={seg(side === "long", "up")}>Long</button>
              <button onClick={() => setSide("short")} className={seg(side === "short", "down")}>Short</button>
            </div>

            <label className="flex flex-col gap-1.5 text-[12px] text-muted">
              Size (USD)
              <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" className={field} />
              <span className="flex gap-1.5">
                {SIZES.map((s) => <button key={s} type="button" onClick={() => setUsd(String(s))} className={btnSm}>${s}</button>)}
              </span>
            </label>

            <div className="flex flex-col gap-1.5 text-[12px] text-muted">
              <span className="flex justify-between">Leverage {m && <span className="text-faint">up to {m.maxLeverage}× on {m.name}</span>}</span>
              <div className="flex gap-1.5">
                {LEVERAGES.filter((l) => !m || l <= m.maxLeverage).map((l) => (
                  <button key={l} onClick={() => setLev(l)} className={`h-9 flex-1 rounded-lg text-[13px] font-semibold tabular-nums ${leverage === l ? "bg-fg text-bg" : "bg-raised text-muted"}`}>{l}×</button>
                ))}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] tabular-nums">
              <dt className="text-muted">Price now</dt><dd className="text-right">{mark ? px(mark) : "–"}</dd>
              <dt className="text-muted">Margin</dt><dd className="text-right">{money(margin)} AUSD</dd>
              <dt className="text-muted">Liquidation ≈</dt><dd className="text-right">{liq ? px(liq) : "–"} <span className="text-faint">({mark ? Math.abs(((liq - mark) / mark) * 100).toFixed(0) : "–"}% away)</span></dd>
              <dt className="text-muted">Fee ≈</dt><dd className="text-right">{money(fee)}</dd>
            </dl>

            {mark > 0 && liq > 0 && Math.abs(liq - mark) / mark < 0.15 && (
              <p className="rounded-lg bg-warn/10 text-warn px-3 py-2 text-[12px]">
                At {leverage}× a {Math.round((Math.abs(liq - mark) / mark) * 100)}% move against you liquidates this position. Lower leverage gives it more room.
              </p>
            )}
            <button
              onClick={() => m && run("open", () => openPerp(net, m, side, size, leverage))}
              disabled={!!busy || !canTrade}
              className={`h-12 rounded-xl text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 ${side === "long" ? "bg-buy-fill" : "bg-sell-fill"}`}
            >
              {busy === "open" && <Loader2 className="size-4 animate-spin" />}
              {net === "testnet" ? "Practice · " : "Real funds · "}{!acctId ? "Deposit AUSD to trade" : margin > free ? "Not enough AUSD for this margin" : `${side === "long" ? "Long" : "Short"} ${m?.name ?? ""} · ${money(size)} at ${leverage}×`}
            </button>
            <p className="text-[11px] text-faint">
              Market order on <a href={PERPL_APP[net]} target="_blank" rel="noreferrer" className="underline">Perpl</a> {net}, filled within 1% of the price shown or not at all. Signed by your passkey, no prompt.
              {net === "mainnet" && " Real funds."}
            </p>
          </section>

          <Positions net={net} positions={positions.data ?? []} accountId={acctId} busy={busy} run={run} />
        </>
      )}
    </div>
  );
}

function Positions({ net, positions, accountId, busy, run }: { net: PerpNet; positions: MyPosition[]; accountId: bigint; busy: string | null; run: (k: string, fn: () => Promise<unknown>) => Promise<void> }) {
  if (!accountId) return null;
  return (
    <section className={`${card} overflow-hidden`}>
      <h2 className="px-4 h-11 flex items-center gap-2 border-b border-line text-[13px] font-semibold">
        Your positions <span className="text-faint font-normal">{positions.length || ""}</span>
        <span className="ml-auto font-normal"><TelegramConnect /></span>
      </h2>
      {!positions.length ? (
        <p className="px-4 py-5 text-[13px] text-muted">No open positions.</p>
      ) : (
        <ul>
          {positions.map((p) => (
            <li key={p.market.id} className="px-4 py-3 border-b border-line last:border-0 flex items-center gap-3">
              <div className="flex-1 min-w-0 text-[13px] tabular-nums">
                <div className="font-semibold">
                  <span className={p.side === "long" ? "text-up" : "text-down"}>{p.side === "long" ? "Long" : "Short"}</span> {p.market.name} · {p.leverage.toFixed(1)}×
                </div>
                <div className="text-muted">
                  {money(p.size * p.mark)} · {px(p.entry)} → {px(p.mark)} · liq ≈ {px(p.liquidation)}
                </div>
              </div>
              <span className={`text-[14px] font-semibold tabular-nums ${p.pnl >= 0 ? "text-up" : "text-down"}`}>{signed(p.pnl)}</span>
              <button onClick={() => run(`close:${p.market.id}`, () => closePerp(net, p, accountId))} disabled={!!busy} className={btnSm}>
                {busy === `close:${p.market.id}` ? <Loader2 className="size-3.5 animate-spin" /> : null} Close
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Mainnet: swap MON for AUSD on Kuru without leaving Kadd. */
function GetAusd({ busy, run }: { busy: string | null; run: (k: string, fn: () => Promise<unknown>) => Promise<void> }) {
  const { user } = useStore();
  const [mon, setMon] = useState("400");
  const quote = useAsync(() => (user && Number(mon) > 0 ? quoteAusd(user.address, Number(mon)) : Promise.resolve(null)), [mon, user]);
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-raised/60 p-3">
      <p className="text-[12px] text-muted">
        No AUSD yet. Swap MON for AUSD on Kuru, straight from this account
        {quote.data ? <>: {mon} MON ≈ <b className="text-fg tabular-nums">{quote.data.toFixed(2)} AUSD</b></> : ":"}
      </p>
      <div className="flex gap-2">
        <input value={mon} onChange={(e) => setMon(e.target.value)} inputMode="decimal" aria-label="MON to swap" className={`${input} w-24 flex-none`} />
        <button
          onClick={() => run("swap", () => swapOnKuru("buy", AUSD.mainnet, BigInt(Math.round(Number(mon) * 1e6)) * 10n ** 12n, "AUSD", 6))}
          disabled={!!busy || !(Number(mon) > 0)}
          className="h-10 flex-1 rounded-lg border border-line-strong text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {busy === "swap" && <Loader2 className="size-4 animate-spin" />} Swap MON → AUSD
        </button>
      </div>
      <a href="https://www.kuru.io" target="_blank" rel="noreferrer" className="text-[11px] text-faint inline-flex items-center gap-1">Routed by Kuru Flow <ExternalLink className="size-3" /></a>
    </div>
  );
}


