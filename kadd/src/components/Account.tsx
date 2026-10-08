"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Coins, Copy, Droplet, ExternalLink, Lock, LogOut, Star, Users, Wallet } from "lucide-react";
import { short } from "@/lib/mock";
import { logout, openLogin, toast, useStore } from "@/lib/store";
import { faucet, requestGas, useWallet } from "@/lib/swap";
import { chain, getMonBalance, isUnlocked, lock } from "@/lib/wallet";

export default function Account() {
  const { user } = useStore();
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [mon, setMon] = useState<number | "error" | null>(null);

  useEffect(() => {
    if (!user || !open) return;
    getMonBalance(user.address).then(setMon, () => setMon("error"));
  }, [user, open]);

  if (!user)
    return (
      <button onClick={() => openLogin()} className="h-8 px-3.5 rounded-md bg-fg text-bg text-[13px] font-semibold whitespace-nowrap hover:opacity-90">
        Sign in
      </button>
    );

  const unlocked = isUnlocked();
  const item = "flex items-center gap-2 px-3 h-9 hover:bg-hover w-full";
  const close = () => setOpen(false);

  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && close()}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-md border border-line hover:bg-hover">
        <span className="relative size-6 rounded bg-brand-fill text-[#0e1013] grid place-items-center text-[11px] font-bold">
          {user.name[0].toUpperCase()}
          {!unlocked && <Lock className="absolute -bottom-1 -right-1 size-3 p-px rounded-full bg-panel text-muted" />}
        </span>
        <span className="hidden xl:flex items-center gap-1.5 tabular-nums text-[12px] font-medium" title="Free test USDC on Monad testnet">
          {wallet ? wallet.usdc.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "…"} tUSDC <span className="px-1 rounded bg-warn/15 text-warn text-[10px] font-semibold">TESTNET</span>
        </span>
        <ChevronDown className="size-3.5 text-muted" />
      </button>

      {open && (
        <div className="absolute z-30 right-0 top-10 w-64 rounded-lg border border-line bg-panel shadow-2xl overflow-hidden text-[13px]">
          <div className="px-3 py-3 border-b border-line flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium">Passkey account</span>
              <span className={`text-[11px] font-medium ${unlocked ? "text-up" : "text-muted"}`}>{unlocked ? "● Session active" : "Locked"}</span>
            </div>
            <button
              onClick={() => (navigator.clipboard?.writeText(user.address), toast("Address copied"))}
              className="flex items-center gap-1.5 font-mono text-[12px] text-muted hover:text-fg"
            >
              {short(user.address)} <Copy className="size-3" />
            </button>
            <dl className="mt-1 grid grid-cols-2 gap-1.5 tabular-nums">
              <div className="rounded-md bg-raised px-2 py-1.5">
                <dt className="text-[10px] text-muted">tUSDC</dt>
                <dd className="font-semibold">{wallet ? wallet.usdc.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "…"}</dd>
              </div>
              <div className="rounded-md bg-raised px-2 py-1.5" title="Testnet MON pays for gas">
                <dt className="text-[10px] text-muted">MON (gas)</dt>
                <dd className={`font-semibold ${typeof mon === "number" && mon < 0.05 ? "text-warn" : ""}`}>{mon === null ? "…" : mon === "error" ? "–" : mon.toFixed(3)}</dd>
              </div>
            </dl>
            {typeof mon === "number" && mon < 0.05 && (
              <button onClick={() => (close(), requestGas(user.address))} className="text-left text-[11px] text-warn hover:underline">
                You need testnet MON for gas. Get some free →
              </button>
            )}
            {!unlocked && (
              <button onClick={() => (close(), openLogin())} className="mt-1 h-8 rounded-md bg-fg text-bg font-semibold text-[12px]">
                Unlock with passkey
              </button>
            )}
          </div>
          <button onClick={() => (close(), faucet())} className={item}><Coins className="size-4 text-muted" /> Get 1,000 test USDC</button>
          <Link href="/portfolio" onClick={close} className={item}><Wallet className="size-4 text-muted" /> Portfolio</Link>
          <Link href="/groups" onClick={close} className={item}><Users className="size-4 text-muted" /> My groups</Link>
          <Link href="/portfolio#watchlist" onClick={close} className={item}><Star className="size-4 text-muted" /> Watchlist</Link>
          <a href={`${chain.blockExplorers?.default.url}/address/${user.address}`} target="_blank" rel="noreferrer" className={item}>
            <ExternalLink className="size-4 text-muted" /> View on explorer
          </a>
          <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" className={item}>
            <Droplet className="size-4 text-muted" /> Testnet MON faucet
          </a>
          <button onClick={() => (lock(), logout(), close())} className={`${item} text-down border-t border-line`}>
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
