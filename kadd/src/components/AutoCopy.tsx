"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, ShieldCheck } from "lucide-react";
import { zeroAddress } from "viem";
import { COPY_READY, copiesOf, startCopy, stopCopy } from "@/lib/copy";
import { COPY_MAINNET } from "@/lib/addresses";
import { short, usd } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { useAsync } from "@/lib/useAsync";
import { Panel, PanelEmpty, StatusPill, TokenIcon, card } from "./ui";
import WalletAvatar from "./WalletAvatar";

const field = "h-9 w-full px-3 rounded-md bg-raised outline-none border border-transparent focus:border-line-strong tabular-nums";

/** Starts a KaddCopy vault that follows `leader` automatically. */
export function AutoCopyForm({ leader }: { leader: string }) {
  const { user, rev } = useStore();
  const [perTrade, setPerTrade] = useState("10");
  const [dailyCap, setDailyCap] = useState("50");
  const [deposit, setDeposit] = useState("100");
  const [copySells, setCopySells] = useState(true);
  const [busy, setBusy] = useState(false);
  const mine = useAsync(() => (user ? copiesOf(user.address) : Promise.resolve([])), [user?.address, rev]);
  const existing = mine.data?.find((c) => c.active && c.leader === leader.toLowerCase());

  const n = (s: string) => Number(s) || 0;
  const invalid = n(perTrade) <= 0 || n(dailyCap) < n(perTrade) || n(deposit) <= 0;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await startCopy(leader, { perTrade: n(perTrade), dailyCap: n(dailyCap), deposit: n(deposit), copySells });
    setBusy(false);
  };

  return (
    <article className={`${card} p-4 gap-3`}>
      <div className="flex items-center gap-2">
        <Bot className="size-4 text-muted" />
        <h2 className="text-[13px] font-semibold">Auto copy</h2>
        {existing && <StatusPill tone="up">On</StatusPill>}
      </div>
      {!COPY_READY ? (
        <p className="text-[12px] text-muted">Auto copy turns on once the KaddCopy contract is deployed. Until then, copy trades one tap at a time.</p>
      ) : existing ? (
        <p className="text-[12px] text-muted">
          You’re auto-copying this wallet: {usd(existing.perTrade)} per buy, up to {usd(existing.dailyCap)} a day. Vault value {usd(existing.value)}.{" "}
          <Link href="/portfolio#copy" className="text-fg underline">Manage</Link>
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <p className="text-[12px] text-muted">Fund a vault with tUSDC. Every new trade this wallet makes on a token Kadd lists is copied into it on testnet within a few minutes.</p>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-muted">
            <label>Per buy<input value={perTrade} onChange={(e) => setPerTrade(e.target.value)} inputMode="decimal" className={field} /></label>
            <label>Daily limit<input value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} inputMode="decimal" className={field} /></label>
            <label>Deposit<input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" className={field} /></label>
          </div>
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={copySells} onChange={(e) => setCopySells(e.target.checked)} className="accent-current" />
            Exit when this wallet sells
          </label>
          <button disabled={busy || invalid} className="h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-fg text-bg text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 className="size-3.5 animate-spin" />} Start auto copy
          </button>
          <p className="flex gap-1.5 text-[11px] text-faint">
            <ShieldCheck className="size-3.5 shrink-0" /> Limits are enforced by the contract. Stop anytime to get your tUSDC and tokens back.
          </p>
        </form>
      )}
      <p className="pt-2.5 border-t border-line text-[11px] text-faint">
        {COPY_MAINNET === zeroAddress ? (
          <>On Monad mainnet with real MON, routed through Kuru: <span className="text-muted">coming soon</span>. The vault contract is built and fork-tested.</>
        ) : (
          <>Mainnet vault (real MON via Kuru): <a href={`https://monadscan.com/address/${COPY_MAINNET}`} target="_blank" rel="noreferrer" className="text-muted underline font-mono">{short(COPY_MAINNET)}</a></>
        )}
      </p>
    </article>
  );
}

/** The user's copy vaults, with stop buttons. While open, it also nudges the keeper so copies land promptly. */
export function CopyVaults() {
  const { user, rev } = useStore();
  const { data, loading, reload } = useAsync(() => (user ? copiesOf(user.address) : Promise.resolve([])), [user?.address, rev]);
  const [busy, setBusy] = useState<bigint | null>(null);
  const active = data?.some((c) => c.active);

  useEffect(() => {
    if (!active) return;
    const tick = () => fetch("/api/copy/keeper").then(reload, () => {});
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [active, reload]);

  if (!COPY_READY) return null;
  const rows = data?.filter((c) => c.active) ?? [];
  return (
    <section id="copy" className="scroll-mt-4">
      <Panel title="Copy trading" count={rows.length || undefined}>
        {loading ? (
          <PanelEmpty>Loading…</PanelEmpty>
        ) : !rows.length ? (
          <PanelEmpty>
            No auto copies yet. Open a wallet from the <Link href="/leaderboard" className="text-fg underline">Leaderboard</Link> and start one.
          </PanelEmpty>
        ) : (
          <ul>
            {rows.map((c) => (
              <li key={String(c.id)} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line last:border-0">
                <WalletAvatar address={c.leader} size={28} />
                <div className="min-w-0 flex-1">
                  <Link href={`/wallet/${c.leader}`} className="font-mono text-[13px] font-semibold hover:underline">{short(c.leader)}</Link>
                  <div className="text-[11px] text-muted tabular-nums">
                    {usd(c.perTrade)}/buy · {usd(c.spentToday)} of {usd(c.dailyCap)} today{c.copySells ? " · exits on sells" : ""}
                  </div>
                  {c.positions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.positions.map((p) => (
                        <span key={p.market.address} className="h-5 px-1.5 rounded-md bg-raised text-[11px] inline-flex items-center gap-1 tabular-nums">
                          <TokenIcon t={{ address: p.market.source.toLowerCase(), image: null }} size={12} /> {p.market.symbol} {usd(p.value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-[14px] font-semibold">{usd(c.value)}</div>
                  <div className="text-[11px] text-muted">{usd(c.cash)} cash</div>
                </div>
                <Link href={`/vault/${c.id}`} className="h-8 px-3 inline-flex items-center rounded-lg border border-line-strong text-[12px] font-semibold hover:bg-hover">
                  View &amp; share
                </Link>
                <button
                  onClick={async () => {
                    setBusy(c.id);
                    await stopCopy(c.id);
                    setBusy(null);
                  }}
                  disabled={busy !== null}
                  className="h-8 px-3 rounded-lg border border-line-strong text-[12px] font-semibold hover:bg-hover disabled:opacity-50"
                >
                  {busy === c.id ? <Loader2 className="inline size-3 animate-spin" /> : "Stop & withdraw"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}
