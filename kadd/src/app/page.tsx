import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Activity, Eye, Fingerprint, ScanSearch, ShieldCheck } from "lucide-react";
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

const WHY = [
  { icon: Fingerprint, title: "No seed phrase", body: "Your account comes from the passkey on your phone. Same passkey on a new device, same account. Gas is sent for you." },
  { icon: ShieldCheck, title: "Your keys stay yours", body: "Copy vaults and clubs hold funds in contracts with hard limits, and you can close or withdraw at any time." },
  { icon: Eye, title: "Risk you can read", body: "Every token gets a 0–100 risk score with the reason for each point. Every perps trader shows how close they are to liquidation." },
];

const compact = (n: number) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : Math.round(n).toString());

export default async function Landing() {
  // Live from Perpl (Monad mainnet); each card falls back to plain copy if Perpl can't be read.
  const risk = await perpRisk().catch(() => null);
  const btc = risk?.markets.find((m) => m.name === "BTC");
  const away = 1 / 3 - 1 / 25; // a 3× BTC long, liquidated at 25×

  return (
    <div className="landing overflow-x-clip bg-bg text-fg antialiased">
      <SmoothScroll />
      <LandingNav />

      {/* Hero: headline left, pitch and action right */}
      <section className="px-5 pt-28 md:px-8 md:pt-36">
        <div className="mx-auto grid max-w-[1280px] items-end gap-8 md:grid-cols-[1.6fr_1fr] md:gap-16">
          <h1 className="text-balance text-[clamp(40px,5.2vw,76px)] font-normal leading-[1.04] tracking-[-0.04em]">
            Follow Monad&apos;s
            {" "}<br className="hidden md:block" />
            smart money, safely
          </h1>
          <div className="flex max-w-[380px] flex-col items-start gap-5 md:justify-self-end md:pb-3">
            <p className="text-[15px] leading-relaxed text-muted">
              See who&apos;s actually winning on Monad, check their risk, then copy them with limits a contract enforces. One passkey, no seed phrase.
            </p>
            <Pill href="/start" arrow>
              Try it in 60 seconds
            </Pill>
          </div>
        </div>
      </section>

      {/* Hero visual with the three promises on a glass card */}
      <section className="px-3 pt-10 md:px-5 md:pt-14">
        <div className="relative mx-auto max-w-[1360px] overflow-hidden rounded-[28px] md:rounded-[36px]">
          <Image src="/landing/space.jpg" alt="" fill preload sizes="100vw" className="object-cover object-[50%_35%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1b0f4d]/10 to-[#120a33]/40" />
          <div className="relative px-3 pb-3 pt-[clamp(180px,26vw,340px)] md:px-10 md:pb-10">
            <div className="grid gap-8 rounded-[22px] bg-white/80 p-6 text-[#0a0a0a] shadow-[0_30px_80px_-30px_rgb(20_10_60/0.5)] ring-1 ring-white/60 backdrop-blur-xl md:grid-cols-[1fr_1.1fr] md:gap-14 md:p-10 dark:bg-[#0b0b0c]/70 dark:text-white dark:ring-white/10">
              <div className="flex flex-col items-start justify-between gap-6">
                <div>
                  <h2 className="text-balance text-[clamp(28px,3vw,40px)] font-normal leading-[1.08] tracking-[-0.03em]">Find who&apos;s winning. Follow them with limits.</h2>
                  <p className="mt-4 max-w-[42ch] text-[14px] leading-relaxed opacity-70">
                    Kadd turns Monad&apos;s public trading data into something you can act on: rank the traders, check how they trade, then follow them inside rules you set.
                  </p>
                </div>
                <Pill href="/leaderboard" arrow className="bg-[#0a0a0a] text-white dark:bg-white dark:text-[#0a0a0a]">
                  See who&apos;s winning
                </Pill>
              </div>
              <ul className="grid gap-6">
                {HERO_POINTS.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="grid grid-cols-[40px_1fr] gap-4">
                    <span className="grid size-10 place-items-center rounded-full ring-1 ring-black/10 dark:ring-white/15">
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

      {/* The terminal itself, interactive with demo data */}
      <section id="terminal" className="scroll-mt-20 px-3 pt-24 md:px-5 md:pt-32">
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto mb-10 max-w-[640px] px-2 text-center md:mb-14">
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

      <Fx>
        {/* Why Kadd */}
        <section id="why" className="relative scroll-mt-20 px-5 py-24 md:px-8 md:py-32">
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
            <div data-anim="rise" className="mt-16 grid gap-10 md:grid-cols-3 md:gap-12">
              {WHY.map(({ icon: Icon, title, body }) => (
                <article key={title}>
                  <Icon className="size-7 text-muted" strokeWidth={1.4} />
                  <h3 className="mt-6 text-[19px] font-medium tracking-[-0.01em]">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
                </article>
              ))}
            </div>
            <div className="mt-16 flex justify-center">
              <Pill href="/start" arrow>
                Start in a minute
              </Pill>
            </div>
          </div>
        </section>

        {/* Features: dark band with bento cards */}
        <section id="features" className="on-dark scroll-mt-20 border-y border-line bg-bg px-5 py-24 text-fg md:px-8 md:py-32">
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

            <div data-anim="rise" className="mt-14 grid gap-4 md:grid-cols-2">
              <article className="flex flex-col overflow-hidden rounded-[22px] bg-panel ring-1 ring-line md:row-span-2">
                <div className="p-6 pb-0">
                  <h3 className="text-[19px] font-medium leading-snug tracking-[-0.01em]">Smart money, ranked and backtested</h3>
                  <p className="mt-1 text-[12px] text-muted">Nansen · Monad mainnet · updated daily</p>
                </div>
                <div className="relative mt-6 aspect-[16/11] flex-1 overflow-hidden">
                  <Image src="/landing/space.jpg" alt="" fill sizes="(min-width: 768px) 560px, 100vw" className="object-cover object-[50%_70%]" />
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

              <article className="flex flex-col justify-between gap-8 rounded-[22px] bg-panel p-6 ring-1 ring-line">
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

              <article className="flex flex-col justify-between gap-8 rounded-[22px] bg-panel p-6 ring-1 ring-line">
                <div>
                  <h3 className="text-[19px] font-medium leading-snug tracking-[-0.01em]">A liquidation map for every market</h3>
                  <p className="mt-1 text-[12px] text-muted">Every open Perpl position · live</p>
                </div>
                <div>
                  <p className="text-[clamp(20px,2vw,26px)] font-normal leading-tight tracking-[-0.02em]">
                    {btc ? (
                      <>
                        A 5% BTC drop liquidates <span className="text-[#ff8b7a]">{compact(liquidatedAt(btc.liqMap, -5))}</span> of longs right now
                      </>
                    ) : (
                      "See how much a 5% move would liquidate, market by market"
                    )}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-4">
                  <p className="text-[13px] leading-relaxed text-muted">
                    {risk ? `${risk.near.count} positions sit within 5% of liquidation. See who, and where the cascade would start.` : "See who sits closest to liquidation, and where the cascade would start."}
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
        <section id="start" className="scroll-mt-20 px-5 py-24 md:px-8 md:py-32">
          <div className="mx-auto max-w-[1180px]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 data-anim="lines" className="text-balance text-[clamp(28px,3.2vw,42px)] font-normal leading-[1.12] tracking-[-0.03em]">
                Turn a good trader
                {" "}<br className="hidden md:block" />
                <span className="text-muted">into your next trade</span>
              </h2>
              <Pill href="/start" arrow>
                Get started
              </Pill>
            </div>

            <div data-anim="rise" className="mt-12 grid gap-4 md:grid-cols-2">
              {[
                { title: "Your first trade in a minute", body: "Sign in with a passkey, get gas sent to you, copy a real trader's latest buy. A timer runs from arrival to the confirmed trade.", ui: <PasskeySheet className="w-full max-w-[300px]" />, tint: "from-[#f6e7ff] via-[#fff5fb] to-[#e9f8ff]", href: "/start" },
                { title: "Copy a wallet automatically", body: "Fund a copy vault, set a limit per buy and per day. New trades by that wallet are copied within minutes; stop and withdraw anytime.", ui: <LeaderboardMini className="w-full max-w-[340px]" />, tint: "from-[#e8fff4] via-[#f5fffb] to-[#eef3ff]", href: "/leaderboard" },
                { title: "Pool it with friends", body: "A copy club is one vault, many members. Deposits only while the club holds no tokens, so nobody joins at a bad price; everyone exits with their share.", ui: <ClubMini className="w-full max-w-[340px]" />, tint: "from-[#eef0ff] via-[#f7f5ff] to-[#fff3ea]", href: "/groups" },
                { title: "New tokens, risk in plain words", body: "Every new Monad token as it launches, with a safety check that says why: liquidity, holders, honeypot tests, who is buying.", ui: <TrenchesMini className="w-full max-w-[360px]" />, tint: "from-[#fff6e6] via-[#fffaf3] to-[#effbff]", href: "/trenches" },
              ].map((c) => (
                <Link key={c.title} href={c.href} className="group flex flex-col overflow-hidden rounded-[22px] bg-bg ring-1 ring-line transition-shadow hover:shadow-[0_20px_50px_-25px_rgb(0_0_0/0.25)]">
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
      </Fx>

      {/* CTA band and footer, dark in both themes */}
      <div className="on-dark bg-bg text-fg">
        <section className="px-3 pt-3 md:px-5 md:pt-5">
          <div className="relative mx-auto max-w-[1360px] overflow-hidden rounded-[28px] px-6 py-20 text-center md:rounded-[36px] md:py-28">
            <Image src="/landing/space.jpg" alt="" fill sizes="100vw" className="object-cover object-[50%_45%]" />
            <div className="absolute inset-0 bg-[#140b3d]/25" />
            <div className="relative mx-auto max-w-[640px]">
              <h2 className="text-balance text-[clamp(30px,4vw,52px)] font-normal leading-[1.08] tracking-[-0.03em] text-white">Trade like the best wallets on Monad</h2>
              <p className="mx-auto mt-4 max-w-[48ch] text-[14px] leading-relaxed text-white/75">
                Free on testnet with test USDC, live on mainnet through Kuru and Perpl when you&apos;re ready. One passkey for both.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Pill href="/start" tone="light" arrow>
                  Try it in 60 seconds
                </Pill>
                <Pill href="/trenches" tone="ghost">
                  Launch app
                </Pill>
              </div>
            </div>
          </div>
        </section>

        <footer className="px-5 pb-8 pt-16 md:px-8">
          <div className="mx-auto max-w-[1180px]">
            <div className="flex flex-wrap justify-between gap-12">
              <div>
                <Link href="/" className="flex items-center gap-2">
                  <Logo size={24} />
                  <span className="text-[16px] font-semibold tracking-[-0.02em]">kadd</span>
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
            <div aria-hidden className="mt-16 select-none text-center text-[clamp(96px,24vw,340px)] font-semibold leading-[0.8] tracking-[-0.07em] text-white/[0.06]">
              kadd
            </div>
            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-[12px] text-muted">
              <span>Monad testnet for practice, mainnet via Kuru and Perpl. Contracts are unaudited.</span>
              <Link href="/stats" className="hover:text-fg">Contracts & live stats</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
