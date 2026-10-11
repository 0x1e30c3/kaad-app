"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Check, Fuel, Loader2, Rss, Timer } from "lucide-react";
import type { Candidate } from "@/lib/wallets";
import { openLogin, toggleFollow, useStore } from "@/lib/store";
import { buyToken, requestGas, useWallet } from "@/lib/swap";
import { EXPLORER } from "@/lib/venue";
import { short, usd } from "@/lib/mock";
import { TokenIcon, card } from "./ui";
import WalletAvatar from "./WalletAvatar";
import InviteCard from "./InviteCard";

const STARTED = "kadd:start:at";
const BEST = "kadd:start:best";
const COPY_USD = 10;
const read = (k: string, store: Storage) => {
  try {
    return Number(store.getItem(k)) || 0;
  } catch {
    return 0;
  }
};
const write = (k: string, v: number, store: Storage) => {
  try {
    store.setItem(k, String(v));
  } catch {}
};
const secs = (ms: number) => (ms / 1000).toFixed(ms < 10_000 ? 1 : 0);

function Step({ n, current, title, children }: { n: number; current: number; title: string; children?: React.ReactNode }) {
  const state = current > n ? "done" : current === n ? "now" : "next";
  return (
    <li className={`grid grid-cols-[32px_1fr] gap-3 ${state === "next" ? "opacity-50" : ""}`}>
      <span className={`grid place-items-center size-8 rounded-full text-[13px] font-semibold ${state === "done" ? "bg-buy-fill text-white" : state === "now" ? "bg-fg text-bg" : "bg-raised text-muted"}`}>
        {state === "done" ? <Check className="size-4" /> : n}
      </span>
      <div className="min-w-0 flex flex-col gap-2.5 pt-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {state === "now" && children}
      </div>
    </li>
  );
}

/**
 * Landing → first confirmed trade with one passkey prompt and three taps: sign in, wait for gas (sent automatically),
 * pick a wallet, copy its latest buy. A timer runs from the first visit to the confirmed receipt.
 */
export default function QuickStart({ candidates }: { candidates: Candidate[] }) {
  const { user, fills, following } = useStore();
  const wallet = useWallet();
  const [pick, setPick] = useState<Candidate | null>(candidates[0] ?? null);
  const [busy, setBusy] = useState<"gas" | "copy" | null>(null);
  const [done, setDone] = useState<{ ms: number; best: number } | null>(null);
  const [now, setNow] = useState(0);

  // Timer: started on the first visit of this browser session, ticking until the trade confirms.
  useEffect(() => {
    if (!read(STARTED, sessionStorage)) write(STARTED, Date.now(), sessionStorage);
    const tick = () => setNow(Date.now() - read(STARTED, sessionStorage));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, []);

  const hasGas = (wallet?.mon ?? 0) >= 0.01;
  const step = !user ? 1 : !hasGas ? 2 : done ? 4 : 3;

  const copy = async () => {
    if (!pick) return;
    setBusy("copy");
    const t = pick.lastBuy.token;
    const ok = await buyToken({ address: t.address, symbol: t.symbol, name: t.symbol, image: t.image, price: t.price }, COPY_USD);
    setBusy(null);
    if (!ok) return;
    if (!following.includes(pick.address)) toggleFollow(pick.address);
    const ms = Date.now() - read(STARTED, sessionStorage);
    const best = Math.min(read(BEST, localStorage) || ms, ms);
    write(BEST, best, localStorage);
    setDone({ ms, best });
  };
  // buyToken records the fill in the store before it returns, so the newest fill is this trade.
  const hash = done ? (fills[0]?.hash ?? "") : "";

  return (
    <div className="flex flex-col gap-5">
      <div className={`${card} p-4 flex-row items-center gap-3`}>
        <Timer className="size-5 text-muted" />
        <div className="flex-1">
          <div className="text-[12px] text-muted">{done ? "First trade confirmed in" : "Time since you arrived"}</div>
          <div className="text-[26px] font-semibold tabular-nums tracking-[-0.02em]" suppressHydrationWarning>
            {secs(done ? done.ms : now)} s
          </div>
        </div>
        {done && done.best < done.ms && <span className="text-[12px] text-muted tabular-nums">Best on this device: {secs(done.best)} s</span>}
      </div>

      <ol className={`${card} p-5 gap-6`}>
        <Step n={1} current={step} title="Create your account">
          <p className="text-[13px] text-muted">One passkey (Face ID, Touch ID or Windows Hello). No wallet app, no seed phrase.</p>
          <button onClick={() => openLogin()} className="self-start h-10 px-4 rounded-lg bg-fg text-bg text-[14px] font-semibold">Sign in with a passkey</button>
        </Step>

        <Step n={2} current={step} title="Get gas">
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Loader2 className="size-3.5 animate-spin" /> {wallet ? "Sending you free testnet MON for gas…" : "Checking your gas…"}
          </p>
          <button
            onClick={async () => {
              setBusy("gas");
              await requestGas(user!.address);
              setBusy(null);
            }}
            disabled={!!busy}
            className="self-start h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-line-strong text-[13px] font-semibold hover:bg-hover disabled:opacity-50"
          >
            {busy === "gas" ? <Loader2 className="size-3.5 animate-spin" /> : <Fuel className="size-3.5" />} Still waiting? Send again
          </button>
        </Step>

        <Step n={3} current={step} title="Copy a trader you'd follow">
          {!candidates.length ? (
            <p className="text-[13px] text-muted">
              No active traders right now. <Link href="/token/0x350035555e10d9afaf1566aaebfced5ba6c27777" className="text-fg underline">Buy $10 of CHOG instead</Link>.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-muted">Real Monad wallets with the best record. You copy their latest buy with ${COPY_USD} of free test USDC and follow them.</p>
              <div role="radiogroup" aria-label="Trader to copy" className="grid gap-2 sm:grid-cols-3">
                {candidates.map((c) => {
                  const on = pick?.address === c.address;
                  return (
                    <button
                      key={c.address}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPick(c)}
                      className={`text-left flex flex-col gap-2 rounded-lg border p-3 ${on ? "border-fg ring-1 ring-fg" : "border-line hover:border-line-strong"}`}
                    >
                      <span className="flex items-center gap-2">
                        <WalletAvatar address={c.address} src={c.avatar} size={24} />
                        <span className={`text-[13px] font-semibold truncate ${c.nns ? "" : "font-mono"}`}>{c.nns ?? short(c.address)}</span>
                      </span>
                      <span className="text-[12px] text-muted tabular-nums">
                        {c.pnl30d !== null ? (
                          <>Nansen smart money · <span className={c.pnl30d >= 0 ? "text-up" : "text-down"}>{c.pnl30d >= 0 ? "+" : ""}{usd(c.pnl30d)}</span> 30d</>
                        ) : (
                          <>Copy ROI <span className={c.copyRoi >= 0 ? "text-up" : "text-down"}>{c.copyRoi >= 0 ? "+" : ""}{c.copyRoi.toFixed(1)}%</span> · {c.trades} trades</>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 text-[12px]">
                        <TokenIcon t={c.lastBuy.token} size={16} /> Latest buy: <b>{c.lastBuy.token.symbol}</b> {usd(c.lastBuy.usd)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button onClick={copy} disabled={!pick || !!busy} className="self-start h-11 px-5 inline-flex items-center gap-2 rounded-lg bg-buy-fill text-white text-[14px] font-semibold disabled:opacity-50">
                {busy === "copy" ? <Loader2 className="size-4 animate-spin" /> : null}
                {busy === "copy" ? "Confirming onchain…" : pick ? `Copy: buy $${COPY_USD} of ${pick.lastBuy.token.symbol}` : "Pick a trader"}
              </button>
            </>
          )}
        </Step>

        <Step n={4} current={step} title="You're trading">
          <p className="text-[13px] text-muted">
            Confirmed on Monad testnet
            {hash && (
              <>
                {" "}·{" "}
                <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" className="text-fg underline">view transaction</a>
              </>
            )}
            . You now follow {pick ? (pick.nns ?? short(pick.address)) : "this trader"}.
          </p>
          <div className="flex flex-wrap gap-2">
            {pick && (
              <Link href={`/wallet/${pick.address}#auto-copy`} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-fg text-bg text-[13px] font-semibold">
                <Bot className="size-3.5" /> Copy them automatically
              </Link>
            )}
            <Link href="/groups" className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-line-strong text-[13px] font-semibold hover:bg-hover">
              <Rss className="size-3.5" /> Their trades, live
            </Link>
            <Link href="/portfolio" className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-line-strong text-[13px] font-semibold hover:bg-hover">
              Portfolio <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Step>
      </ol>
      {done && <InviteCard />}
    </div>
  );
}
