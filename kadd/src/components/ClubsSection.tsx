"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatUnits } from "viem";
import { Landmark, Loader2, Plus, ShieldCheck } from "lucide-react";
import { createClub, listClubs, txError } from "@/lib/club";
import { MARKETS, USDC_DECIMALS } from "@/lib/kuru";
import { requireAccount, toast, useStore } from "@/lib/store";
import { useAsync } from "@/lib/useAsync";
import { short } from "@/lib/mock";

const CAPS = [1_000, 2_500, 5_000];

function CreateClubForm({ onDone }: { onDone: (club: string) => void }) {
  const [name, setName] = useState("");
  const [cap, setCap] = useState(2_500);
  const [picked, setPicked] = useState<string[]>([MARKETS[0].address, MARKETS[1].address]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !picked.length) return;
    setBusy(true);
    try {
      if (!(await requireAccount())) return;
      const club = await createClub(name.trim(), cap, MARKETS.filter((m) => picked.includes(m.address)));
      toast(`Club "${name.trim()}" created onchain`);
      onDone(club);
    } catch (err) {
      toast(txError(err), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-4 p-4 rounded-lg border border-line bg-panel flex flex-col gap-4">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Club name, e.g. Campus Fund" maxLength={40} className="h-10 px-3 rounded-md bg-raised outline-none border border-transparent focus:border-line-strong placeholder:text-faint" />

      <div className="flex flex-col gap-2">
        <span className="text-[12px] text-muted">Markets the captain can trade</span>
        <div className="flex flex-wrap gap-1.5">
          {MARKETS.map((m) => {
            const on = picked.includes(m.address);
            return (
              <button type="button" key={m.address} aria-pressed={on} onClick={() => setPicked(on ? picked.filter((a) => a !== m.address) : [...picked, m.address])} className={`h-8 px-3 rounded-md border text-[12px] font-medium ${on ? "border-fg/50 text-fg" : "border-line text-faint"}`}>
                {m.symbol}/USDC
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[12px] text-muted">Buy limit per trade (of club USDC balance)</span>
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

export default function ClubsSection() {
  const router = useRouter();
  const { user } = useStore();
  const [creating, setCreating] = useState(false);
  const { data: clubs, error, loading } = useAsync(listClubs, []);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-semibold">Club onchain</h2>
        <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-up/10 text-up text-[11px] font-medium">
          <ShieldCheck className="size-3" /> Monad testnet
        </span>
        <button onClick={() => setCreating(!creating)} className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-line-strong text-[12px] font-semibold hover:bg-hover">
          <Plus className="size-3.5" /> Create club
        </button>
      </div>
      <p className="text-muted text-[12px] mb-3 max-w-2xl">
        Pool funds on Kuru: members deposit USDC, the captain trades within a per-trade cap enforced by the contract, and any member can withdraw their share anytime. Anyone can create a club, so check the captain before you deposit.
      </p>

      {creating && <CreateClubForm onDone={(c) => router.push(`/clubs/${c}`)} />}

      {loading ? (
        <div className="h-24 grid place-items-center text-muted"><Loader2 className="size-5 animate-spin" /></div>
      ) : error ? (
        <p className="p-4 rounded-lg border border-line text-down">Couldn’t load clubs from chain.</p>
      ) : !clubs?.length ? (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-line-strong text-muted">
          <Landmark className="size-5 shrink-0" />
          No clubs yet. Be the first captain.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => (
            <Link key={c.address} href={`/clubs/${c.address}`} className="flex flex-col gap-2 p-4 rounded-lg border border-line bg-panel hover:border-line-strong">
              <div className="flex items-center gap-2">
                <div className="grid place-items-center size-9 rounded-lg bg-raised"><Landmark className="size-4" /></div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-[11px] text-muted font-mono">
                    captain {user && c.captain.toLowerCase() === user.address.toLowerCase() ? "you" : short(c.captain)}
                  </div>
                </div>
              </div>
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-muted">USDC in club</span>
                <span className="font-semibold tabular-nums">{Number(formatUnits(c.usdc, USDC_DECIMALS)).toLocaleString("en-US")} USDC</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
