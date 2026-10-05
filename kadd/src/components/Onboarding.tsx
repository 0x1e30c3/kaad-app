"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { dismissOnboarding, openLogin, useStore } from "@/lib/store";
import { faucet, requestGas, useWallet } from "@/lib/swap";

/** "Get started" checklist. Every step ticks itself off from real state (chain balances, history, groups). */
export default function Onboarding() {
  const { user, fills, joined, onboardingDone } = useStore();
  const wallet = useWallet();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  if (onboardingDone) return null;

  const steps: { title: string; detail: string; done: boolean; action?: React.ReactNode }[] = [
    { title: "Sign in with a passkey", detail: "Face ID or fingerprint. No seed phrase.", done: !!user, action: <button onClick={() => openLogin()} className="font-semibold underline">Sign in</button> },
    {
      title: "Get testnet MON for gas",
      detail: "Every transaction needs a tiny bit of MON. We send it for free.",
      done: (wallet?.mon ?? 0) >= 0.01,
      action: user && (
        <button onClick={async () => (setBusy(true), await requestGas(user.address), setBusy(false))} disabled={busy} className="font-semibold underline inline-flex items-center gap-1">
          {busy && <Loader2 className="size-3 animate-spin" />} Get gas
        </button>
      ),
    },
    {
      title: "Claim 1,000 free test USDC",
      detail: "tUSDC is what you trade with on Kadd testnet.",
      done: (wallet?.usdc ?? 0) > 0 || fills.length > 0,
      action: (
        <button onClick={async () => (setBusy(true), await faucet(), setBusy(false))} disabled={busy} className="font-semibold underline inline-flex items-center gap-1">
          {busy && <Loader2 className="size-3 animate-spin" />} Claim
        </button>
      ),
    },
    { title: "Make your first trade", detail: "Pick any token and buy $10 worth.", done: fills.length > 0, action: <Link href="/token/0x350035555e10d9afaf1566aaebfced5ba6c27777" className="font-semibold underline">Try CHOG</Link> },
    { title: "Join a group or club", detail: "Trade alongside friends and pool funds onchain.", done: joined.length > 0, action: <Link href="/groups" className="font-semibold underline">Browse groups</Link> },
  ];
  const done = steps.filter((s) => s.done).length;
  const next = steps.findIndex((s) => !s.done);

  return (
    <section className="rounded-lg border border-line bg-panel">
      <div className="flex items-center gap-3 px-3 h-11">
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex flex-1 items-center gap-3 text-left">
          <span className="font-semibold text-[13px]">Get started</span>
          <span className="flex-1 max-w-40 h-1.5 rounded-full bg-raised overflow-hidden">
            <span className="block h-full bg-up rounded-full transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
          </span>
          <span className="text-[12px] text-muted tabular-nums">{done}/{steps.length}</span>
          <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button onClick={dismissOnboarding} aria-label="Hide checklist" className="grid place-items-center size-7 rounded-md text-muted hover:text-fg hover:bg-hover">
          <X className="size-4" />
        </button>
      </div>
      {open && (
        <ol className="grid gap-px border-t border-line bg-line sm:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title} className={`flex gap-2.5 p-3 bg-panel text-[12px] ${i === next ? "" : "opacity-80"}`}>
              <span className={`grid place-items-center size-5 shrink-0 rounded-full text-[10px] font-bold ${s.done ? "bg-up text-white" : i === next ? "bg-fg text-bg" : "bg-raised text-muted"}`}>
                {s.done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block font-medium ${s.done ? "line-through text-muted" : ""}`}>{s.title}</span>
                <span className="block text-muted leading-snug">{s.detail}</span>
                {!s.done && i === next && s.action && <span className="mt-1 block">{s.action}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
