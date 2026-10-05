"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatUnits } from "viem";
import { ArrowRight, Coins, Gauge, Loader2, Plus } from "lucide-react";
import { createClub, listClubs, txError, type ClubSummary } from "@/lib/club";
import { EXPLORER, USDC_DECIMALS, VENUE_READY, listMarkets, type Market } from "@/lib/venue";
import { requireAccount, toast, useStore } from "@/lib/store";
import { useAsync } from "@/lib/useAsync";
import { short } from "@/lib/mock";
import { Monogram, PanelEmpty, StatusPill, btnSm, card, hueOf } from "./ui";

const CAPS = [1_000, 2_500, 5_000];

function CreateClubForm({ markets, onDone }: { markets: Market[]; onDone: (club: string) => void }) {
  const [name, setName] = useState("");
  const [cap, setCap] = useState(2_500);
  const [picked, setPicked] = useState<string[]>(markets.slice(0, 3).map((m) => m.address));
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !picked.length) return;
    setBusy(true);
    try {
      if (!(await requireAccount())) return;
      const club = await createClub(name.trim(), cap, markets.filter((m) => picked.includes(m.address)));
      toast(`Club "${name.trim()}" created onchain`);
      onDone(club);
    } catch (err) {
      toast(txError(err), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="p-4 border-b border-line bg-raised/40 flex flex-col gap-4">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Club name, e.g. Campus Fund" maxLength={40} className="h-10 px-3 rounded-md bg-raised outline-none border border-transparent focus:border-line-strong placeholder:text-faint" />

      <div className="flex flex-col gap-2">
        <span className="text-[12px] text-muted">Markets the captain can trade</span>
        <div className="flex flex-wrap gap-1.5">
          {markets.map((m) => {
            const on = picked.includes(m.address);
            return (
              <button type="button" key={m.address} aria-pressed={on} onClick={() => setPicked(on ? picked.filter((a) => a !== m.address) : [...picked, m.address])} className={`h-8 px-3 rounded-md border text-[12px] font-medium ${on ? "border-fg/50 text-fg" : "border-line text-faint"}`}>
                {m.symbol}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[12px] text-muted">Buy limit per trade (of the club’s tUSDC)</span>
        <div className="flex gap-1.5">
          {CAPS.map((c) => (
            <button type="button" key={c} onClick={() => setCap(c)} className={`h-8 px-3 rounded-md border text-[12px] font-medium tabular-nums ${cap === c ? "border-fg/50 text-fg" : "border-line text-faint"}`}>
              {c / 100}%
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button disabled={busy || !name.trim() || !picked.length} className="h-10 px-5 rounded-md bg-fg text-bg font-semibold inline-flex items-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "Creating club…" : "Create club onchain"}
        </button>
        <p className="text-[11px] text-faint">Needs a little MON for gas. You’ll be the captain.</p>
      </div>
    </form>
  );
}

function ClubCard({ c, symbols, mine }: { c: ClubSummary; symbols: string[]; mine: boolean }) {
  const hue = hueOf(c.address);
  const tusdc = Number(formatUnits(c.usdc, USDC_DECIMALS));
  const row = "flex items-center gap-2.5 text-[13px]";
  const icon = "grid place-items-center size-7 shrink-0 rounded-lg bg-raised text-muted [&>svg]:size-3.5";
  return (
    <article className={`${card} p-5 gap-4`}>
      <div className="flex items-start gap-3">
        <Monogram name={c.name} hue={hue} size={40} />
        <div className="min-w-0 flex-1">
          <Link href={`/clubs/${c.address}`} className="block text-[16px] font-semibold leading-tight truncate hover:underline after:absolute after:inset-0">{c.name}</Link>
          <div className="mt-0.5 text-[12px] text-muted truncate">Captain <span className="font-mono">{mine ? "you" : short(c.captain)}</span></div>
        </div>
        {c.flat ? <StatusPill tone="up">Deposits open</StatusPill> : <StatusPill tone="warn">Holding</StatusPill>}
      </div>

      <div>
        <div className="text-[12px] text-muted">Pooled</div>
        <div className="text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
          {tusdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} <span className="text-[14px] font-medium text-muted">tUSDC</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className={row}>
          <span className={icon}><Gauge /></span>
          <span className="text-muted">Buy limit</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="w-16 h-1.5 rounded-full bg-raised overflow-hidden"><span className="block h-full rounded-full bg-fg/60" style={{ width: `${c.maxTradeBps / 100}%` }} /></span>
            <span className="font-medium tabular-nums">{c.maxTradeBps / 100}% / trade</span>
          </span>
        </div>
        <div className={row}>
          <span className={icon}><Coins /></span>
          <span className="text-muted">Markets</span>
          <span className="ml-auto flex flex-wrap justify-end gap-1">
            {symbols.length ? symbols.map((sym) => <span key={sym} className="h-5 px-1.5 rounded-md bg-raised text-[11px] font-medium inline-flex items-center">{sym}</span>) : <span className="text-faint">–</span>}
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-auto flex items-center gap-2 pt-4 border-t border-line">
        <Link href={`/clubs/${c.address}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-fg">
          {mine ? "Manage club" : c.flat ? "Deposit tUSDC" : "View positions"} <ArrowRight className="size-3.5" />
        </Link>
        <a href={`${EXPLORER}/address/${c.address}`} target="_blank" rel="noreferrer" className="ml-auto text-[12px] text-faint hover:text-fg font-mono">{short(c.address)}</a>
      </div>
    </article>
  );
}

const STEPS: [string, string][] = [
  ["Pool", "Friends deposit test USDC and get shares."],
  ["Trade", "The captain trades within a cap the contract enforces."],
  ["Exit", "Anyone withdraws their share anytime, no permission needed."],
];

export default function ClubsSection() {
  const router = useRouter();
  const { user } = useStore();
  const [creating, setCreating] = useState(false);
  const { data: clubs, error, loading, reload } = useAsync(listClubs, []);
  const { data: markets } = useAsync(listMarkets, []);
  const me = user?.address.toLowerCase();
  const symbolOf = (a: string) => markets?.find((m) => m.address.toLowerCase() === a.toLowerCase())?.symbol;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-[15px] font-semibold">Onchain clubs</h2>
        {!!clubs?.length && <span className="text-[13px] text-faint tabular-nums">{clubs.length}</span>}
        <span className="text-[12px] text-muted hidden sm:inline">· Monad testnet</span>
        <button onClick={() => setCreating(!creating)} aria-expanded={creating} className={`ml-auto ${btnSm}`}>
          <Plus className="size-3.5" /> Create club
        </button>
      </div>

      {creating && (
        <div className="mb-3 rounded-xl border border-line bg-panel overflow-hidden">
          {!VENUE_READY ? (
            <PanelEmpty>The testnet venue isn’t deployed yet.</PanelEmpty>
          ) : !markets?.length ? (
            <PanelEmpty>
              No testnet markets yet. Buy any token in <Link href="/trenches" className="text-fg underline">Trenches</Link> to open its pool, then come back.
            </PanelEmpty>
          ) : (
            <CreateClubForm markets={markets} onDone={(c) => router.push(`/clubs/${c}`)} />
          )}
        </div>
      )}

      {loading && !clubs ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-64 rounded-xl border border-line bg-panel animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-line bg-panel">
          <PanelEmpty>
            Couldn’t load clubs from Monad testnet. <button onClick={reload} className="text-fg underline">Try again</button>
          </PanelEmpty>
        </div>
      ) : !clubs?.length ? (
        <div className="rounded-xl border border-line bg-panel p-5 grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="font-semibold">Start the first club</div>
            <p className="mt-0.5 text-[13px] text-muted">A club is a shared pot your group trades together, with rules the contract enforces.</p>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="flex gap-2.5">
                  <span className="grid place-items-center size-6 shrink-0 rounded-full bg-raised text-[12px] font-semibold tabular-nums">{i + 1}</span>
                  <span className="text-[12px] leading-snug"><span className="block font-medium text-[13px]">{t}</span><span className="text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </div>
          {!creating && (
            <button onClick={() => setCreating(true)} className="h-10 px-5 rounded-lg bg-fg text-bg font-semibold hover:opacity-90 inline-flex items-center gap-1.5 justify-center">
              <Plus className="size-4" /> Create club
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => (
            <ClubCard key={c.address} c={c} mine={me === c.captain.toLowerCase()} symbols={c.markets.map(symbolOf).filter((x): x is string => !!x)} />
          ))}
        </div>
      )}
    </section>
  );
}
