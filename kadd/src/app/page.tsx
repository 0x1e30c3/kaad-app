import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Activity, Check, ChevronDown, Eye, Fingerprint, Minus, ScanSearch, ShieldCheck } from "lucide-react";
import LandingNav from "@/components/landing/LandingNav";
import SmoothScroll from "@/components/landing/SmoothScroll";
import Fx from "@/components/landing/Fx";
import Pill from "@/components/landing/Pill";
import Live from "@/components/landing/Live";
import TerminalPreview from "@/components/landing/Terminal";
import { ClubMini, LeaderboardMini, PasskeySheet, TrenchesMini } from "@/components/landing/Widgets";
import { Logo } from "@/components/ui";
import { perpRisk } from "@/lib/perpl";
import { liquidatedAt } from "@/lib/perplRisk";
import { getStats } from "@/lib/stats";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Kadd — Follow Monad's smart money, safely",
  description: "See who's actually winning on Monad, check their risk, and follow them with limits a contract enforces: spot or perps, alone or with friends. One passkey, no seed phrase.",
};

const HERO_POINTS = [
  { icon: ScanSearch, title: "Smart money, checked", body: "Nansen's profitable Monad wallets and every wallet trading right now, each with a copy backtest on its real trades." },
  { icon: ShieldCheck, title: "Limits a contract enforces", body: "Auto copy from a vault capped per trade and per day. Kadd decides when; the contract decides what's allowed." },
  { icon: Activity, title: "Perps with the risk shown first", body: "Trade Perpl from your passkey with the liquidation price on the ticket, and see where every position would break." },
];

const STEPS = [
  { n: "01", title: "Find", body: "Start from who's actually winning: Nansen's profitable Monad wallets, everyone trading right now, and Perpl's top perps traders." },
  { n: "02", title: "Check", body: "Replay a wallet's real trades as if you'd copied them, read each token's risk score, and see how close a perps trader is to liquidation." },
  { n: "03", title: "Follow", body: "Copy one trade in a tap, or fund a vault that copies them for you inside per-trade and per-day limits the contract enforces." },
];

// The piece of product each step happens in. Illustrative values; each carries one small motion that shows what it does.
const STEP_UI = [
  // Find: a ranked list settling into place
  <ol key="find" data-anim="stack" className="grid w-full max-w-[240px] gap-1.5 text-[11px]">
    {([["0x95d2…a648", "+$7,424", 152], ["0xf513…fa1e", "+$2,628", 280], ["0xa77f…8f57", "+$1,360", 30]] as const).map(([w, pnl, h], i) => (
      <li key={w} className={`flex items-center gap-2 rounded-lg bg-panel px-2.5 py-1.5 ring-1 ring-line ${i ? "" : "ring-[#836ef9]/40"}`}>
        <span className="w-3 text-faint tabular-nums">{i + 1}</span>
        <span className="size-4 rounded-full" style={{ background: `hsl(${h} 55% 50%)` }} />
        <span className="flex-1 font-mono">{w}</span>
        <span className="font-medium tabular-nums text-[#2ccf7f]">{pnl}</span>
      </li>
    ))}
  </ol>,
  // Check: a risk score ring that fills to its value, with the reasons beside it
  <div key="check" className="flex items-center gap-4">
    <div className="relative grid size-[76px] place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-line" />
        <circle data-draw="0.23" cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round" stroke="#2ccf7f" pathLength={100} strokeDasharray="100" strokeDashoffset="77" />
      </svg>
      <span className="text-center leading-none">
        <span className="block text-[20px] font-medium tabular-nums">23</span>
        <span className="text-[9px] text-muted">/ 100</span>
      </span>
    </div>
    <ul data-pop className="grid gap-1 text-[11px]">
      {["Deep liquidity", "Spread holders", "Sells work"].map((r) => (
        <li key={r} className="flex items-center gap-1.5">
          <Check data-pop-item className="size-3 text-[#2ccf7f]" />
          {r}
        </li>
      ))}
    </ul>
  </div>,
  // Follow: a vault's daily limit filling up as trades are copied
  <div key="follow" className="w-full max-w-[240px] rounded-xl bg-panel p-3 text-[11px] ring-1 ring-line">
    <div className="flex items-center justify-between">
      <span className="font-medium">Copy vault · 0x95d2…a648</span>
      <span className="flex items-center gap-1 text-[#2ccf7f]">
        <span className="size-1.5 rounded-full bg-[#2ccf7f] motion-safe:animate-pulse" /> On
      </span>
    </div>
    <div className="mt-2.5 flex justify-between text-muted tabular-nums">
      <span>Today</span>
      <span>$30 of $50</span>
    </div>
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
      <div data-fill className="h-full w-[60%] rounded-full bg-[#836ef9]" />
    </div>
    <div data-pop className="mt-2.5 flex items-center gap-1.5 text-muted">
      <Check data-pop-item className="size-3 text-[#2ccf7f]" /> Copied $10 of CHOG
    </div>
  </div>,
];

// Kadd next to a typical copy-trading bot (no bot named: the point is the model, not a competitor).
const COMPARE: [string, string | null, string][] = [
  ["Who holds the keys", "The bot's server", "You, through your passkey"],
  ["Spending limits", "A setting the bot promises to respect", "Per trade and per day, enforced by the contract"],
  ["The trader's record", null, "A backtest of copying their real trades"],
  ["Token safety", null, "A 0–100 risk score with the reason for every point"],
  ["Perps risk", null, "Liquidation price on the ticket before you sign"],
  ["Trading with friends", null, "Copy clubs: one vault, onchain shares, exit anytime"],
  ["Seed phrase", "Exported into a chat", "None. Same passkey, same account on any device"],
];

const FAQ: [string, string][] = [
  ["Is this real money?", "Only when you choose it. Practice runs on Monad testnet with free test USDC and gas sent to you. When you're ready, the same passkey trades real funds on Monad mainnet: spot through Kuru, perps through Perpl."],
  ["Does Kadd hold my funds or keys?", "No. Your account is derived from your passkey and never leaves your device. Copy vaults and clubs are contracts with hard limits; you can stop and withdraw at any time. The contracts are unaudited, so keep amounts small."],
  ["How does auto copy work?", "You fund a vault for one wallet and set a cap per buy and per day. When that wallet trades on Monad mainnet, Kadd copies it within minutes. Kadd decides when; the contract decides what's allowed, and rejects anything over your limits."],
  ["Where does the data come from?", "Straight from the chain and public sources: market data from GeckoTerminal and CoinGecko, smart-money labels and PnL from Nansen, positions read from Perpl's contracts, and history indexed with Envio."],
  ["What does the risk score mean?", "A 0–100 rule-based score for each token. Every point comes with its reason: liquidity, holder concentration, honeypot and tax checks, pool age, and who is buying. It's a checklist, not a promise."],
  ["What if I lose my phone?", "Passkeys sync with your platform's password manager (iCloud Keychain or Google Password Manager). Sign in with the same passkey on a new device and you get the same account."],
];

const WHY = [
  { icon: Fingerprint, title: "No seed phrase", body: "Your account comes from the passkey on your phone. Same passkey on a new device, same account. Gas is sent for you." },
  { icon: ShieldCheck, title: "Your keys stay yours", body: "Copy vaults and clubs hold funds in contracts with hard limits, and you can close or withdraw at any time." },
  { icon: Eye, title: "Risk you can read", body: "Every token gets a 0–100 risk score with the reason for each point. Every perps trader shows how close they are to liquidation." },
];

/** A USD amount that counts up when seen ($67K), static when it's in millions. */
function CountUsd({ value, className }: { value: number; className?: string }) {
  if (value >= 1e6) return <span className={className}>{compact(value)}</span>;
  const k = value >= 1e3;
  const n = Math.round(k ? value / 1e3 : value);
  return (
    <span data-count={n} data-prefix="$" data-suffix={k ? "K" : ""} className={className}>
      {compact(value)}
    </span>
  );
}

const compact = (n: number) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : Math.round(n).toString());

export default async function Landing() {
  // Live from Perpl (Monad mainnet); each card falls back to plain copy if Perpl can't be read.
  const risk = await perpRisk().catch(() => null);
  const btc = risk?.markets.find((m) => m.name === "BTC");
  const away = 1 / 3 - 1 / 25; // a 3× BTC long, liquidated at 25×
  const activity = (await getStats().catch(() => null))?.activity ?? null;
  // The numbers band: live where we can read it, a plain fact where we can't (or where the count is still too small to say much).
  const numbers: { value: React.ReactNode; label: string; note: string }[] = [
    risk ? { value: <CountUsd value={risk.tvl} />, label: "Held by Perpl", note: "AUSD in the exchange contract" } : { value: "4", label: "Perps markets", note: "BTC, ETH, SOL, MON on Perpl" },
    risk ? { value: <CountUsd value={risk.openInterest} />, label: "Open interest", note: "Every Perpl position, live" } : { value: "10×", label: "Max leverage", note: "Liquidation shown before you sign" },
    risk ? { value: <CountUsd value={risk.volume24h} />, label: "Perps volume, 24h", note: "Read from Perpl on Monad mainnet" } : { value: "0–100", label: "Risk score", note: "With the reason for every point" },
    activity && activity.trades >= 500 ? { value: <span data-count={activity.trades}>{activity.trades.toLocaleString("en-US")}</span>, label: "Trades on Kadd", note: `By ${activity.traders.toLocaleString("en-US")} traders on Monad testnet` } : { value: "60s", label: "To your first trade", note: "Passkey, gas sent, copy a trader" },
  ];

  return (
    <div className="landing overflow-x-clip bg-bg text-fg antialiased">
      <SmoothScroll />
      <LandingNav />
      <Fx>

      {/* Hero: headline left, pitch and action right */}
      <section className="px-5 pt-28 md:px-8 md:pt-36">
        <div className="mx-auto grid max-w-[1280px] items-end gap-8 md:grid-cols-[1.6fr_1fr] md:gap-16">
          <h1 data-anim="lines" className="text-balance text-[clamp(40px,5.2vw,76px)] font-normal leading-[1.04] tracking-[-0.04em]">
            Follow Monad&apos;s
            {" "}<br className="hidden md:block" />
            smart money, safely
          </h1>
          <div data-anim="rise" className="flex max-w-[380px] flex-col items-start gap-5 md:justify-self-end md:pb-3">
            <p className="text-[15px] leading-relaxed text-muted">
              See who&apos;s actually winning on Monad, check their risk, then copy them with limits a contract enforces. One passkey, no seed phrase.
            </p>
            <Pill href="/start" arrow magnetic>
              Try it in 60 seconds
            </Pill>
          </div>
        </div>
      </section>

      {/* Hero visual with the three promises on a glass card */}
      <section className="px-3 pt-12 md:px-5 md:pt-20">
        <div className="relative mx-auto max-w-[1360px] overflow-hidden rounded-[28px] md:rounded-[36px]">
          <Image data-parallax src="/landing/space.jpg" alt="" fill preload sizes="100vw" className="object-cover object-[50%_35%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1b0f4d]/10 to-[#120a33]/40" />
          <div data-anim="rise" className="relative px-3 pb-3 pt-[clamp(180px,26vw,340px)] md:px-10 md:pb-10">
            <div className="grid gap-8 rounded-[22px] bg-white/80 p-6 text-[#0a0a0a] shadow-[0_30px_80px_-30px_rgb(20_10_60/0.5)] ring-1 ring-white/60 backdrop-blur-xl md:grid-cols-[1fr_1.1fr] md:gap-14 md:p-10 dark:bg-[#0b0b0c]/70 dark:text-white dark:ring-white/10">
              <div className="flex flex-col items-start justify-between gap-6">
                <div>
                  <h2 className="text-balance text-[clamp(28px,3vw,40px)] font-normal leading-[1.08] tracking-[-0.03em]">Find who&apos;s winning. Follow them with limits.</h2>
                  <p className="mt-4 max-w-[42ch] text-[14px] leading-relaxed opacity-70">
                    Kadd turns Monad&apos;s public trading data into something you can act on: rank the traders, check how they trade, then follow them inside rules you set.
                  </p>
                </div>
                <Pill href="/leaderboard" arrow magnetic className="bg-[#0a0a0a] text-white dark:bg-white dark:text-[#0a0a0a]">
                  See who&apos;s winning
                </Pill>
              </div>
              <ul className="grid gap-6">
                {HERO_POINTS.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="group grid grid-cols-[40px_1fr] gap-4">
                    <span className="grid size-10 place-items-center rounded-full ring-1 ring-black/10 transition-colors duration-300 group-hover:bg-[#0a0a0a] group-hover:text-white dark:ring-white/15 dark:group-hover:bg-white dark:group-hover:text-[#0a0a0a]">
                      <Icon className="size-[18px]" strokeWidth={1.6} />
                    </span>
                    <div>
                      <h3 className="text-[16px] font-medium tracking-[-0.01em]">{title}</h3>
                      <p className="mt-1 text-[13px] leading-relaxed opacity-70">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* By the numbers: live from Perpl and the Kadd contracts */}
      <section aria-label="Kadd by the numbers" className="px-5 pt-20 md:px-8 md:pt-28">
        <div className="mx-auto max-w-[1180px]">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 rounded-full bg-[#2ccf7f] motion-safe:animate-ping" />
              <span className="relative size-1.5 rounded-full bg-[#2ccf7f]" />
            </span>
            Live from Monad
          </p>
          <div className="relative mt-6">
          <span aria-hidden data-anim="hairline" className="absolute inset-x-0 top-0 h-px bg-line" />
          <dl data-anim="rise" className="grid grid-cols-2 md:grid-cols-4">
            {numbers.map((x, i) => (
              <div key={x.label} className={`group flex flex-col gap-2 border-b border-line py-7 md:border-b-0 md:py-9 ${i % 2 ? "pl-5 md:pl-8" : "pr-5 md:pr-8"} ${i > 0 ? "md:border-l md:pl-8" : ""} ${i % 2 ? "border-l" : ""}`}>
                <dt className="order-2 text-[14px] font-medium">{x.label}</dt>
                <dd className="order-1 text-[clamp(32px,3.6vw,52px)] font-normal leading-none tracking-[-0.04em] tabular-nums transition-colors duration-300 group-hover:text-[#836ef9]">{x.value}</dd>
                <dd className="order-3 text-[12px] leading-relaxed text-muted">{x.note}</dd>
              </div>
            ))}
          </dl>
          </div>
        </div>
      </section>

      {/* The terminal itself, interactive with demo data */}
      <section id="terminal" className="scroll-mt-20 px-3 pt-32 md:px-5 md:pt-48">
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto mb-12 max-w-[640px] px-2 text-center md:mb-16">
            <p className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              <span className="size-1 rounded-full bg-fg" />
              The terminal
            </p>
            <h2 className="mt-4 text-balance text-[clamp(28px,3.2vw,42px)] font-normal leading-[1.1] tracking-[-0.03em]">Pick a token, read its risk, trade it with friends</h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-[14px] leading-relaxed text-muted">
              Live Monad token data, a safety check on every token, one-tap orders signed by your passkey, and your club&apos;s trades right next to the chart.
            </p>
          </div>
          <TerminalPreview />
        </div>
      </section>

        {/* Why Kadd */}
        <section id="why" className="relative scroll-mt-20 px-5 py-32 md:px-8 md:py-48">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-10 mx-auto h-[420px] max-w-[900px] rounded-full bg-[radial-gradient(closest-side,rgb(131_110_249/0.16),transparent)] blur-2xl" />
          <div className="relative mx-auto max-w-[1180px]">
            <div className="grid gap-6 md:grid-cols-[1.25fr_1fr] md:items-end">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  <span className="size-1 rounded-full bg-fg" />
                  Why Kadd
                </p>
                <h2 data-anim="lines" className="text-balance mt-4 text-[clamp(30px,3.4vw,44px)] font-normal leading-[1.1] tracking-[-0.03em]">
                  Copy the best wallets
                  {" "}<br className="hidden md:block" />
                  without giving up your keys
                </h2>
              </div>
              <p className="max-w-[46ch] text-[15px] leading-relaxed text-muted md:justify-self-end">
                Copy bots want your private key. Kadd never sees one: your account is a passkey, your copies run in vaults with hard limits, and every risk is spelled out before you commit.
              </p>
            </div>
            <div data-anim="rise" className="mt-16 grid gap-12 md:mt-20 md:grid-cols-3 md:gap-12">
              {WHY.map(({ icon: Icon, title, body }) => (
                <article key={title} className="group">
                  <Icon className="size-7 text-muted transition duration-500 group-hover:-translate-y-1 group-hover:rotate-[-8deg] group-hover:text-[#836ef9]" strokeWidth={1.4} />
                  <h3 className="mt-6 text-[19px] font-medium tracking-[-0.01em]">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
                </article>
              ))}
            </div>
            <div className="mt-16 flex justify-center md:mt-20">
              <Pill href="/start" arrow magnetic>
                Start in a minute
              </Pill>
            </div>
          </div>
        </section>

        {/* How it works: three steps, each with the piece of UI it happens in */}
        <section id="how" className="scroll-mt-20 px-5 pb-32 md:px-8 md:pb-48">
          <div className="mx-auto max-w-[1180px]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  <span className="size-1 rounded-full bg-fg" />
                  How it works
                </p>
                <h2 data-anim="lines" className="mt-4 text-balance text-[clamp(28px,3.2vw,42px)] font-normal leading-[1.12] tracking-[-0.03em]">
                  Find them, check them,
                  {" "}<br className="hidden md:block" />
                  <span className="text-muted">then follow them</span>
                </h2>
              </div>
              <p className="max-w-[40ch] text-[14px] leading-relaxed text-muted">Three steps, about a minute the first time. Every step shows you the numbers before you commit.</p>
            </div>
            <ol data-anim="rise" data-steps className="relative mt-14 grid gap-4 md:mt-20 md:grid-cols-3 md:gap-5">
              {/* Rules from each step's badge to the next (badge: 24px padding + 44px circle; column: (100% − 2×20px) / 3) */}
              {[0, 1].map((i) => (
                <span key={i} aria-hidden data-steps-line className="absolute top-[45px] z-20 hidden h-px bg-[#836ef9]/60 md:block" style={{ left: `calc(${i} * ((100% - 40px) / 3 + 20px) + 76px)`, width: "calc((100% - 40px) / 3 - 40px)" }} />
              ))}
              {STEPS.map((s, i) => (
                <li key={s.n} data-spotlight className="spotlight group relative flex flex-col gap-6 rounded-[22px] bg-panel p-6 ring-1 ring-line transition-shadow hover:shadow-[0_20px_50px_-25px_rgb(0_0_0/0.25)]">
                  <span data-step className="relative z-10 grid size-11 place-items-center rounded-full bg-bg text-[13px] font-medium tabular-nums ring-1 ring-line transition-colors duration-500 group-hover:bg-[#836ef9] group-hover:text-white group-hover:ring-[#836ef9] data-lit:bg-[#836ef9] data-lit:text-white data-lit:ring-[#836ef9]">{s.n}</span>
                  <div className="grid h-[132px] place-items-center rounded-2xl bg-raised p-4">{STEP_UI[i]}</div>
                  <div>
                    <h3 className="text-[19px] font-medium tracking-[-0.01em]">{s.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features: dark band with bento cards */}
        <section id="features" className="on-dark scroll-mt-20 border-y border-line bg-bg px-5 py-28 text-fg md:px-8 md:py-44">
          <div className="mx-auto max-w-[1180px]">
            <div className="mx-auto max-w-[760px] text-center">
              <p className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                <span className="size-1 rounded-full bg-fg" />
                Features
              </p>
              <h2 data-anim="lines" className="text-balance mt-4 text-[clamp(30px,3.6vw,48px)] font-normal leading-[1.1] tracking-[-0.03em]">
                Every winning wallet on Monad,
                {" "}<br className="hidden md:block" />
                <span className="text-white/40">and the risk behind it</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[56ch] text-[14px] leading-relaxed text-muted">
                Read straight from the chain, not from screenshots: who is trading, what they made, how much leverage they carry, and what would happen if the market moved.
              </p>
            </div>

            <div data-anim="rise" className="mt-14 grid gap-4 md:mt-20 md:grid-cols-2 md:gap-5">
              <article data-spotlight className="spotlight flex flex-col overflow-hidden rounded-[22px] bg-panel ring-1 ring-line md:row-span-2">
                <div className="p-6 pb-0">
                  <h3 className="text-[19px] font-medium leading-snug tracking-[-0.01em]">Smart money, ranked and backtested</h3>
                  <p className="mt-1 text-[12px] text-muted">Nansen · Monad mainnet · updated daily</p>
                </div>
                <div className="relative mt-6 aspect-[16/11] flex-1 overflow-hidden">
                  <Image data-parallax src="/landing/space.jpg" alt="" fill sizes="(min-width: 768px) 560px, 100vw" className="object-cover object-[50%_70%]" />
                  <div className="absolute inset-0 grid place-items-center p-6">
                    <LeaderboardMini className="w-full max-w-[340px] shadow-2xl" />
                  </div>
                </div>
                <div className="flex flex-col items-start gap-4 p-6">
                  <p className="text-[13px] leading-relaxed text-muted">
                    Wallets Nansen labels as profitable on Monad, next to everyone trading right now. Before you follow anyone, replay their real trades: what would copying them have returned?
                  </p>
                  <Pill href="/leaderboard" tone="outline" arrow className="h-9 text-[13px]">
                    View leaderboard
                  </Pill>
                </div>
              </article>

              <article data-spotlight className="spotlight flex flex-col justify-between gap-8 rounded-[22px] bg-panel p-6 ring-1 ring-line">
                <div>
                  <h3 className="text-[19px] font-medium leading-snug tracking-[-0.01em]">Perps on Perpl, from your passkey</h3>
                  <p className="mt-1 text-[12px] text-muted">Long or short · up to 10× · AUSD</p>
                </div>
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 rounded-xl bg-raised p-4 text-[13px] tabular-nums max-sm:grid-cols-1 max-sm:gap-y-1">
                  <span className="text-muted">Long BTC · $100 at 3×</span>
                  <span className="font-medium sm:justify-self-end">margin $33.33</span>
                  <span className="text-muted max-sm:mt-2">Liquidation ≈</span>
                  <span className="font-medium text-[#ff8b7a] sm:justify-self-end">{btc ? `$${Math.round(btc.mark * (1 - away)).toLocaleString("en-US")} (${Math.round(away * 100)}% away)` : `${Math.round(away * 100)}% below entry`}</span>
                </div>
                <div className="flex flex-col items-start gap-4">
                  <p className="text-[13px] leading-relaxed text-muted">Trade like a trader you found, with the liquidation price on the ticket before you sign. No API key, no wallet app.</p>
                  <Pill href="/perps" tone="outline" arrow className="h-9 text-[13px]">
                    Open perps
                  </Pill>
                </div>
              </article>

              <article data-spotlight className="spotlight flex flex-col justify-between gap-8 rounded-[22px] bg-panel p-6 ring-1 ring-line">
                <div>
                  <h3 className="text-[19px] font-medium leading-snug tracking-[-0.01em]">A liquidation map for every market</h3>
                  <p className="mt-1 text-[12px] text-muted">Every open Perpl position · live</p>
                </div>
                <div>
                  <p className="text-[clamp(20px,2vw,26px)] font-normal leading-tight tracking-[-0.02em]">
                    {btc ? (
                      <>
                        A 5% BTC drop liquidates <CountUsd value={liquidatedAt(btc.liqMap, -5)} className="text-[#ff8b7a]" /> of longs right now
                      </>
                    ) : (
                      "See how much a 5% move would liquidate, market by market"
                    )}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-4">
                  <p className="text-[13px] leading-relaxed text-muted">
                    {risk ? (
                      <>
                        <span data-count={risk.near.count}>{risk.near.count}</span> positions sit within 5% of liquidation. See who, and where the cascade would start.
                      </>
                    ) : (
                      "See who sits closest to liquidation, and where the cascade would start."
                    )}
                  </p>
                  <Pill href="/perps/risk" tone="outline" arrow className="h-9 text-[13px]">
                    View risk
                  </Pill>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Get started: 2×2 product cards */}
        <section id="start" className="scroll-mt-20 px-5 py-32 md:px-8 md:py-48">
          <div className="mx-auto max-w-[1180px]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 data-anim="lines" className="text-balance text-[clamp(28px,3.2vw,42px)] font-normal leading-[1.12] tracking-[-0.03em]">
                Turn a good trader
                {" "}<br className="hidden md:block" />
                <span className="text-muted">into your next trade</span>
              </h2>
              <Pill href="/start" arrow magnetic>
                Get started
              </Pill>
            </div>

            <div data-anim="rise" className="mt-12 grid gap-4 md:mt-16 md:grid-cols-2 md:gap-5">
              {[
                { title: "Your first trade in a minute", body: "Sign in with a passkey, get gas sent to you, copy a real trader's latest buy. A timer runs from arrival to the confirmed trade.", ui: <PasskeySheet className="w-full max-w-[300px]" />, tint: "from-[#f6e7ff] via-[#fff5fb] to-[#e9f8ff]", href: "/start" },
                { title: "Copy a wallet automatically", body: "Fund a copy vault, set a limit per buy and per day. New trades by that wallet are copied within minutes; stop and withdraw anytime.", ui: <LeaderboardMini className="w-full max-w-[340px]" />, tint: "from-[#e8fff4] via-[#f5fffb] to-[#eef3ff]", href: "/leaderboard" },
                { title: "Pool it with friends", body: "A copy club is one vault, many members. Deposits only while the club holds no tokens, so nobody joins at a bad price; everyone exits with their share.", ui: <ClubMini className="w-full max-w-[340px]" />, tint: "from-[#eef0ff] via-[#f7f5ff] to-[#fff3ea]", href: "/groups" },
                { title: "New tokens, risk in plain words", body: "Every new Monad token as it launches, with a safety check that says why: liquidity, holders, honeypot tests, who is buying.", ui: <TrenchesMini className="w-full max-w-[360px]" />, tint: "from-[#fff6e6] via-[#fffaf3] to-[#effbff]", href: "/trenches" },
              ].map((c) => (
                <Link key={c.title} href={c.href} data-tilt data-spotlight className="spotlight group flex flex-col overflow-hidden rounded-[22px] bg-bg ring-1 ring-line transition-shadow hover:shadow-[0_20px_50px_-25px_rgb(0_0_0/0.25)]">
                  <div className={`grid aspect-[16/9] place-items-center bg-gradient-to-br p-6 ${c.tint} dark:from-[#17151f] dark:via-[#121214] dark:to-[#141a1f]`}>
                    <div className="w-full transition-transform duration-500 group-hover:-translate-y-1 [&>*]:mx-auto [&>*]:shadow-[0_18px_40px_-20px_rgb(0_0_0/0.3)]">{c.ui}</div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-[17px] font-medium tracking-[-0.01em]">{c.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{c.body}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
        {/* Kadd next to a typical copy bot */}
        <section id="compare" className="scroll-mt-20 px-5 pb-32 md:px-8 md:pb-48">
          <div className="mx-auto max-w-[1180px]">
            <div className="mx-auto max-w-[680px] text-center">
              <p className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                <span className="size-1 rounded-full bg-fg" />
                Compare
              </p>
              <h2 data-anim="lines" className="mt-4 text-balance text-[clamp(28px,3.2vw,42px)] font-normal leading-[1.12] tracking-[-0.03em]">Copy trading, without handing over your wallet</h2>
              <p className="mx-auto mt-4 max-w-[52ch] text-[14px] leading-relaxed text-muted">Most copy bots ask for your private key and promise to behave. Kadd moves the promises into contracts and puts the numbers in front of you.</p>
            </div>
            <div data-pop className="mt-12 overflow-hidden rounded-[22px] ring-1 ring-line md:mt-16">
              <div className="grid grid-cols-[1.1fr_1fr_1.25fr] bg-raised text-[12px] font-medium text-muted max-md:grid-cols-[1fr_1fr]">
                <span className="px-5 py-4 max-md:hidden md:px-6" />
                <span className="px-5 py-4 md:px-6">Typical copy bot</span>
                <span className="flex items-center gap-2 bg-[#836ef9]/10 px-5 py-4 text-fg md:px-6">
                  <Logo size={14} /> Kadd
                </span>
              </div>
              {COMPARE.map(([what, bot, kadd]) => (
                <div key={what} className="grid grid-cols-[1.1fr_1fr_1.25fr] border-t border-line text-[13px] transition-colors hover:bg-hover/60 max-md:grid-cols-[1fr_1fr]">
                  <span className="px-5 py-4 font-medium max-md:col-span-2 max-md:pb-0 md:px-6">{what}</span>
                  <span className="flex items-start gap-2 px-5 py-4 text-muted md:px-6">
                    <Minus className="mt-0.5 size-3.5 shrink-0 text-faint" />
                    {bot ?? "Not offered"}
                  </span>
                  <span className="flex items-start gap-2 bg-[#836ef9]/[0.06] px-5 py-4 md:px-6">
                    <Check data-pop-item className="mt-0.5 size-3.5 shrink-0 text-[#836ef9]" />
                    {kadd}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ: plain answers, native disclosure */}
        <section id="faq" className="scroll-mt-20 px-5 pb-32 md:px-8 md:pb-40">
          <div className="mx-auto grid max-w-[1180px] gap-10 md:grid-cols-[1fr_1.5fr] md:gap-20">
            <div className="md:sticky md:top-28 md:self-start">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                <span className="size-1 rounded-full bg-fg" />
                FAQ
              </p>
              <h2 data-anim="lines" className="mt-4 text-balance text-[clamp(28px,3.2vw,42px)] font-normal leading-[1.12] tracking-[-0.03em]">Questions, answered plainly</h2>
              <p className="mt-4 max-w-[36ch] text-[14px] leading-relaxed text-muted">Still unsure? Try it with test money first: nothing on testnet costs you anything.</p>
              <Pill href="/start" tone="outline" arrow className="mt-6 h-10 text-[13px]">
                Try it free
              </Pill>
            </div>
            <div className="relative">
              <span aria-hidden data-anim="hairline" className="absolute inset-x-0 top-0 h-px bg-line" />
              {FAQ.map(([q, a]) => (
                <details key={q} className="group border-b border-line [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-[16px] font-medium tracking-[-0.01em] transition-colors hover:text-[#836ef9]">
                    {q}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-line transition duration-300 group-open:rotate-180 group-open:bg-fg group-open:text-bg">
                      <ChevronDown className="size-4" />
                    </span>
                  </summary>
                  <p className="max-w-[62ch] pb-6 pr-12 text-[14px] leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

      {/* CTA band and footer, dark in both themes */}
      <div className="on-dark bg-bg text-fg">
        <section className="px-3 pt-12 md:px-5 md:pt-16">
          <div className="relative mx-auto max-w-[1360px] overflow-hidden rounded-[28px] px-6 py-20 text-center md:rounded-[36px] md:py-28">
            <Image data-parallax src="/landing/space.jpg" alt="" fill sizes="100vw" className="object-cover object-[50%_45%]" />
            <div className="absolute inset-0 bg-[#140b3d]/25" />
            <div className="relative mx-auto max-w-[640px]">
              <h2 data-anim="lines" className="text-balance text-[clamp(30px,4vw,52px)] font-normal leading-[1.08] tracking-[-0.03em] text-white">Trade like the best wallets on Monad</h2>
              <p className="mx-auto mt-4 max-w-[48ch] text-[14px] leading-relaxed text-white/75">
                Free on testnet with test USDC, live on mainnet through Kuru and Perpl when you&apos;re ready. One passkey for both.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Pill href="/start" tone="light" arrow magnetic>
                  Try it in 60 seconds
                </Pill>
                <Pill href="/trenches" tone="ghost">
                  Launch app
                </Pill>
              </div>
            </div>
          </div>
        </section>

        <footer className="px-5 pb-8 pt-20 md:px-8 md:pt-28">
          <div className="mx-auto max-w-[1180px]">
            <div className="flex flex-wrap justify-between gap-12">
              <div>
                <Link href="/" aria-label="Kadd home" className="flex items-center">
                  <Logo size={26} />
                </Link>
                <p className="mt-5 max-w-[22ch] text-[18px] tracking-[-0.01em]">Follow Monad&apos;s smart money, safely.</p>
                <div className="mt-5 text-muted [&>div]:flex-wrap [&>div]:gap-x-5 [&>div]:gap-y-1 [&>div]:text-[13px]">
                  <Live compact />
                </div>
              </div>
              <nav className="grid grid-cols-2 gap-x-14 gap-y-8 text-[13px] sm:grid-cols-3">
                {(
                  [
                    ["Product", [["Trenches", "/trenches"], ["Perps", "/perps"], ["Leaderboard", "/leaderboard"], ["Groups & clubs", "/groups"], ["Portfolio", "/portfolio"]]],
                    ["Data", [["Stats", "/stats"], ["Perps risk", "/perps/risk"], ["Compare traders", "/perps/compare"], ["AI agents", "/agents"]]],
                    ["Built on", [["Monad", "https://monad.xyz"], ["Kuru", "https://www.kuru.io"], ["Perpl", "https://app.perpl.xyz"], ["Nansen", "https://www.nansen.ai"], ["Envio", "https://envio.dev"], ["Mera", "https://github.com/category-labs/mera"]]],
                  ] as const
                ).map(([group, links]) => (
                  <div key={group}>
                    <h3 className="font-medium">{group}</h3>
                    <ul className="mt-4 grid gap-2.5 text-muted">
                      {links.map(([label, href]) => (
                        <li key={label}>
                          {href.startsWith("http") ? (
                            <a href={href} target="_blank" rel="noreferrer" className="hover:text-fg">{label}</a>
                          ) : (
                            <Link href={href} className="hover:text-fg">{label}</Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>
            <div aria-hidden data-anim="lines" className="mt-16 select-none text-center text-[clamp(96px,24vw,340px)] font-semibold leading-[0.8] tracking-[-0.07em] text-white/[0.06]">
              kadd
            </div>
            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-[12px] text-muted">
              <span>Monad testnet for practice, mainnet via Kuru and Perpl. Contracts are unaudited.</span>
              <Link href="/stats" className="hover:text-fg">Contracts & live stats</Link>
            </div>
          </div>
        </footer>
      </div>
      </Fx>
    </div>
  );
}
