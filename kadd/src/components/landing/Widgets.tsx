"use client";
// Product UI pieces shown on the landing page (leaderboard, trenches list, club card, passkey sheet). Colours come from the landing's
// theme tokens, so they follow light/dark. Live-looking motion starts after mount only (no hydration mismatch).
import { useEffect, useState } from "react";
import Image from "next/image";
import { Crown, Fingerprint, ShieldAlert, ShieldCheck, TrendingUp } from "lucide-react";

const surface = "bg-panel text-fg ring-1 ring-line shadow-[0_12px_32px_rgb(0_0_0/0.06)]";
const muted = "text-muted";
const sub = "bg-raised";
const UP = "#2ccf7f";
const DOWN = "#f2475d";

/** Hook: a value that ticks every `ms` after mount. */
function useTick(ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

// ---------------------------------------------------------------- trenches list

const TRENCH = [
  { s: "CHOG", h: 140, age: "4m", mc: 1.21, risk: "safe" },
  { s: "NADS", h: 260, age: "12m", mc: 0.38, risk: "caution" },
  { s: "MOE", h: 30, age: "31m", mc: 3.84, risk: "safe" },
  { s: "BLITZ", h: 90, age: "1h", mc: 0.09, risk: "danger" },
] as const;

export function TrenchesMini({ className = "" }: { className?: string }) {
  const tick = useTick(1800);
  return (
    <div className={`rounded-2xl p-3 ${surface} ${className}`}>
      <div className={`mb-1.5 flex items-center justify-between px-1 text-[11px] font-medium ${muted}`}>
        <span>Trenches · new on Monad</span>
        <TrendingUp className="size-3.5" />
      </div>
      <ul className="grid gap-1">
        {TRENCH.map((t, i) => {
          const wiggle = tick ? Math.sin(tick * 1.7 + i * 2) * 4 : 0; // % change that moves after mount
          const ch = [12.4, -3.1, 6.8, -18.2][i] + wiggle;
          const Risk = t.risk === "safe" ? ShieldCheck : ShieldAlert;
          const riskColor = t.risk === "safe" ? UP : t.risk === "caution" ? "#e6a23c" : DOWN;
          return (
            <li key={t.s} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px]">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white" style={{ background: `hsl(${t.h} 50% 46%)` }}>
                {t.s.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{t.s}</span> <span className={muted}>{t.age}</span>
              </span>
              <Risk className="size-3.5" style={{ color: riskColor }} />
              <span className="w-14 text-right tabular-nums font-medium">${t.mc}M</span>
              <span className="w-14 text-right tabular-nums font-medium transition-colors" style={{ color: ch >= 0 ? UP : DOWN }}>
                {ch >= 0 ? "+" : ""}
                {ch.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- leaderboard

export function LeaderboardMini({ className = "" }: { className?: string }) {
  const rows = [
    ["salsa", 2565, 300],
    ["rizky", 2394, 200],
    ["andre", 2365, 20],
    ["you", 1180, 80],
  ] as const;
  return (
    <div className={`rounded-2xl p-3 ${surface} ${className}`}>
      <div className={`mb-2 flex items-center justify-between px-1 text-[11px] font-medium ${muted}`}>
        <span>Weekly leaderboard · Demo</span>
        <span>PnL</span>
      </div>
      <ol className="grid gap-1.5">
        {rows.map(([name, pnl, hue], i) => (
          <li key={name} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] ${name === "you" ? sub : ""}`}>
            <span className="w-4 text-center">{i === 0 ? <Crown className="mx-auto size-3.5 text-[#e6a23c]" /> : <span className={muted}>{i + 1}</span>}</span>
            <span className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: `hsl(${hue} 45% 48%)` }}>
              {name[0].toUpperCase()}
            </span>
            <span className="flex-1 font-medium">{name}</span>
            <span className={`h-1.5 w-16 overflow-hidden rounded-full ${sub}`}>
              <span className="block h-full rounded-full" style={{ width: `${(pnl / 2565) * 100}%`, background: UP }} />
            </span>
            <span className="w-14 text-right tabular-nums font-semibold" style={{ color: UP }}>+${pnl.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- club card

export function ClubMini({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl p-4 ${surface} ${className}`}>
      <div className="flex items-center gap-3">
        <span className="relative size-10 shrink-0 rounded-xl bg-raised">
          <Image src="/landing/coin-stack.png" alt="" fill sizes="40px" className="object-contain p-1" />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold">Campus Fund</div>
          <div className={`text-[11px] ${muted}`}>Captain rara · 25% max per trade</div>
        </div>
        <span className="ml-auto rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgb(44 207 127 / 0.12)", color: UP }}>
          Open
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[["USDC", "1,250"], ["Members", "6"], ["Your share", "16.6%"]].map(([k, v]) => (
          <div key={k} className={`rounded-lg p-2 ${sub}`}>
            <div className={`text-[10px] ${muted}`}>{k}</div>
            <div className="text-[15px] font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1">
        {["25%", "50%", "75%", "100%"].map((p) => (
          <span key={p} className={`grid h-7 place-items-center rounded-md text-[11px] font-semibold ring-1 ring-line`}>
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- passkey sheet

export function PasskeySheet({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl p-5 text-center ${surface} ${className}`}>
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#c6ee2e] text-[#0a0a0a]">
        <Fingerprint className="size-6" />
      </div>
      <div className="mt-3 text-[15px] font-semibold">Sign in to Kadd</div>
      <div className={`mt-1 text-[12px] ${muted}`}>Use Face ID to continue. No seed phrase.</div>
      <div className={`mt-4 flex h-9 items-center justify-center rounded-lg text-[13px] font-semibold bg-fg text-bg`}>Continue with passkey</div>
      <div className={`mt-2 text-[11px] ${muted}`}>0x8f3c…a91e · Monad testnet</div>
    </div>
  );
}
