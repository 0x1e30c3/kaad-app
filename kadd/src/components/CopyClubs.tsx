"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isAddress } from "viem";
import { Bot, Loader2, Plus } from "lucide-react";
import { COPY_CLUBS_READY, joinCopyClub, leaveCopyClub, listCopyClubs, startCopyClub, type CopyClubView } from "@/lib/copyClubs";
import { short, usd } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { useAsync } from "@/lib/useAsync";
import { PanelEmpty, StatusPill, btnSm, card } from "./ui";
import WalletAvatar from "./WalletAvatar";

const field = "h-9 w-full px-3 rounded-md bg-raised outline-none border border-transparent focus:border-line-strong tabular-nums placeholder:text-faint";
const choice = (on: boolean) => `h-8 px-3 rounded-md border text-[12px] font-medium tabular-nums ${on ? "border-fg/50 text-fg" : "border-line text-faint"}`;
const PER_TRADE = [5, 10, 20];
const DAILY = [20, 30, 50];

function CreateForm({ leader: initial, onDone }: { leader: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [leader, setLeader] = useState(initial);
  const [perTrade, setPerTrade] = useState(10);
  const [daily, setDaily] = useState(30);
  const [copySells, setCopySells] = useState(true);
  const [deposit, setDeposit] = useState("100");
  const [busy, setBusy] = useState(false);
  const ok = name.trim() && isAddress(leader, { strict: false }) && Number(deposit) > 0 && daily >= perTrade;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        setBusy(true);
        const id = await startCopyClub({ name: name.trim(), leader, perTradePct: perTrade, dailyCapPct: daily, copySells, deposit: Number(deposit) });
        setBusy(false);
        if (id !== null) onDone();
      }}
      className="p-4 border-b border-line bg-raised/40 grid gap-4 md:grid-cols-2"
    >
      <label className="flex flex-col gap-1.5 text-[12px] text-muted">
        Club name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={48} placeholder="e.g. Chog chasers" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-[12px] text-muted">
        Wallet to copy (Monad mainnet)
        <input value={leader} onChange={(e) => setLeader(e.target.value.trim())} placeholder="0x…" className={`${field} font-mono`} />
      </label>
      <div className="flex flex-col gap-1.5 text-[12px] text-muted">
        Each copied buy spends
        <div className="flex gap-1.5">
          {PER_TRADE.map((n) => <button type="button" key={n} onClick={() => setPerTrade(n)} className={choice(perTrade === n)}>{n}%</button>)}
          <span className="self-center">of the club’s cash</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-[12px] text-muted">
        Buys per day at most
        <div className="flex gap-1.5">
          {DAILY.map((n) => <button type="button" key={n} onClick={() => setDaily(n)} disabled={n < perTrade} className={`${choice(daily === n)} disabled:opacity-40`}>{n}%</button>)}
          <span className="self-center">of the day’s cash</span>
        </div>
      </div>
      <label className="flex flex-col gap-1.5 text-[12px] text-muted">
        Your first deposit (tUSDC)
        <input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" className={field} />
      </label>
      <label className="flex items-center gap-2 text-[13px] self-end h-9">
        <input type="checkbox" checked={copySells} onChange={(e) => setCopySells(e.target.checked)} /> Exit a position when the leader sells
      </label>
      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <button disabled={busy || !ok} className="h-10 px-5 rounded-md bg-brand-fill text-[#0a0a0a] font-semibold inline-flex items-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "Creating club…" : "Create copy club"}
        </button>
        <p className="text-[11px] text-faint">Rules are fixed once created. Friends can join while the club holds no tokens; anyone can withdraw anytime.</p>
      </div>
    </form>
  );
}

function ClubCard({ c, signedIn }: { c: CopyClubView; signedIn: boolean }) {
  const [amount, setAmount] = useState("50");
  const [busy, setBusy] = useState<"join" | "leave" | null>(null);
  const mine = c.totalShares > 0n ? Number((c.myShares * 10_000n) / c.totalShares) / 100 : 0;
  return (
    <article className={`${card} p-5 gap-4`}>
      <div className="flex items-start gap-3">
        <WalletAvatar address={c.leader} size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold leading-tight truncate">{c.name}</div>
          <div className="mt-0.5 text-[12px] text-muted truncate">
            Copies <Link href={`/wallet/${c.leader}`} className="font-mono hover:text-fg">{short(c.leader)}</Link>
          </div>
        </div>
        {c.flat ? <StatusPill tone="up">Deposits open</StatusPill> : <StatusPill tone="warn">Holding</StatusPill>}
      </div>
      <div>
        <div className="text-[12px] text-muted">Club value</div>
        <div className="text-[28px] font-semibold tabular-nums tracking-[-0.02em]">{usd(c.value)}</div>
        <div className="text-[12px] text-muted tabular-nums">
          {c.perTradePct}% per buy · {c.dailyCapPct}% per day{c.copySells ? " · exits on sells" : ""}
        </div>
        {c.positions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {c.positions.map((p) => <span key={p.symbol} className="h-5 px-1.5 rounded-md bg-raised text-[11px] inline-flex items-center tabular-nums">{p.symbol} {usd(p.value)}</span>)}
          </div>
        )}
      </div>
      <div className="mt-auto pt-4 border-t border-line flex flex-col gap-2">
        {mine > 0 && <div className="text-[12px] tabular-nums">You own <b>{mine.toFixed(mine < 1 ? 2 : 1)}%</b> · {usd((c.value * mine) / 100)}</div>}
        <div className="flex items-center gap-2">
          {c.flat && signedIn && (
            <>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="Deposit amount in tUSDC" className="h-8 w-20 px-2.5 rounded-md bg-raised outline-none border border-transparent focus:border-line-strong tabular-nums" />
              <button
                onClick={async () => {
                  setBusy("join");
                  await joinCopyClub(c.id, Number(amount));
                  setBusy(null);
                }}
                disabled={!!busy || !(Number(amount) > 0)}
                className={btnSm}
              >
                {busy === "join" ? <Loader2 className="size-3.5 animate-spin" /> : null} {mine > 0 ? "Add" : "Join"}
              </button>
            </>
          )}
          {!c.flat && mine === 0 && <span className="text-[12px] text-muted">Opens for deposits when the club is back in cash.</span>}
          {c.myShares > 0n && (
            <button
              onClick={async () => {
                setBusy("leave");
                await leaveCopyClub(c.id, c.myShares);
                setBusy(null);
              }}
              disabled={!!busy}
              className={`ml-auto ${btnSm}`}
            >
              {busy === "leave" ? <Loader2 className="size-3.5 animate-spin" /> : null} Withdraw all
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Section() {
  const { user, rev } = useStore();
  const leader = useSearchParams().get("leader") ?? "";
  const [creating, setCreating] = useState(isAddress(leader, { strict: false }));
  const me = user?.address;
  const { data: clubs, error, loading, reload } = useAsync(() => listCopyClubs(me), [me, rev]);

  return (
    <section id="copy-clubs" className="scroll-mt-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-[15px] font-semibold">Copy clubs</h2>
        {!!clubs?.length && <span className="text-[13px] text-faint tabular-nums">{clubs.length}</span>}
        <span className="text-[12px] text-muted hidden sm:inline">· pool with friends, auto-copy one wallet</span>
        <button onClick={() => setCreating(!creating)} aria-expanded={creating} className={`ml-auto ${btnSm}`}>
          <Plus className="size-3.5" /> New copy club
        </button>
      </div>
      {creating && (
        <div className="mb-3 rounded-xl border border-line bg-panel overflow-hidden">
          {user ? <CreateForm leader={leader} onDone={() => setCreating(false)} /> : <PanelEmpty>Sign in to create a copy club.</PanelEmpty>}
        </div>
      )}
      {loading && !clubs ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-64 rounded-xl border border-line bg-panel animate-pulse" />)}</div>
      ) : error ? (
        <div className="rounded-xl border border-line bg-panel">
          <PanelEmpty>Couldn’t load copy clubs. <button onClick={reload} className="text-fg underline">Try again</button></PanelEmpty>
        </div>
      ) : !clubs?.length ? (
        <div className="rounded-xl border border-line bg-panel p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <Bot className="size-6 text-muted shrink-0" />
          <p className="flex-1 text-[13px] text-muted">
            A copy club is auto copy with friends: everyone deposits tUSDC, the club copies one Monad wallet within limits the contract enforces, and anyone withdraws their share anytime.
          </p>
          {!creating && <button onClick={() => setCreating(true)} className="h-9 px-4 rounded-lg bg-brand-fill text-[#0a0a0a] text-[13px] font-semibold">Start one</button>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{clubs.map((c) => <ClubCard key={String(c.id)} c={c} signedIn={!!user} />)}</div>
      )}
    </section>
  );
}

/** Copy clubs on Groups & Clubs. Hidden until KaddCopyClubs is deployed (NEXT_PUBLIC_COPY_CLUBS). */
export default function CopyClubs() {
  if (!COPY_CLUBS_READY) return null;
  return (
    <Suspense>
      <Section />
    </Suspense>
  );
}
