import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import SmoothScroll from "@/components/landing/SmoothScroll";
import Fx from "@/components/landing/Fx";
import Cta from "@/components/landing/Cta";
import Live from "@/components/landing/Live";
import { ActivityFeed, ClubMini, LeaderboardMini, PasskeySheet, TrenchesMini } from "@/components/landing/Widgets";
import { Logo } from "@/components/ui";
import { CLUB_FACTORY } from "@/lib/kuru";

export const metadata: Metadata = {
  title: "Kadd — Trade together on Monad",
  description: "The social trading terminal for Monad: passkey sign-in, trading with friends, and onchain clubs on Kuru.",
};

const STEPS = [
  ["Sign in with a passkey", "Face ID, fingerprint, or your device PIN. Your Monad account comes from the passkey — no seed phrase, no extension."],
  ["Start or join a group", "Bring your campus, office, or community. See who's buying what and race for the best weekly PnL."],
  ["Pool funds in a club", "Deposit USDC into an onchain club. The captain trades within a per-trade limit the contract enforces."],
  ["Climb together", "Withdraw your share whenever you want, without anyone's permission. Everything settles on Monad."],
];

const TAGS: [string, string][] = [
  ["Trenches", "#c6ee2e"],
  ["Copy trading", "#ff6b5a"],
  ["Passkeys", "#7aa7ff"],
  ["Onchain clubs", "#b79bff"],
  ["Risk labels", "#ffc14d"],
  ["Leaderboards", "#3fd1a8"],
  ["Kuru order book", "#ff8fbf"],
  ["400ms blocks", "#ff9a3d"],
];

const WHY = [
  ["No seed phrase", "The passkey already on your phone is the key. New device? Your account follows the same passkey."],
  ["Social by default", "gmgn is built for solo traders. Kadd is built for groups: friends' feeds, shared clubs, weekly leaderboards."],
  ["Risk you can read", "Every token gets a safety check with plain-language reasons: holder concentration, dev wallet, snipers, insiders."],
  ["Exchange-grade speed", "Monad closes a block every 400ms. Orders go straight to Kuru's order book — no pending states."],
];

const FEATURES = [
  { title: "Trenches", ui: <TrenchesMini />, tags: ["Discovery", "Risk labels"], body: "Every new Monad token from launch to its Kuru listing, with safety checks written in plain language.", href: "/trenches" },
  { title: "Onchain clubs", ui: <ClubMini />, tags: ["Live on testnet", "Kuru"], body: "Pool USDC with friends. The captain trades inside contract-enforced limits; every member can exit any time.", href: "/groups" },
  { title: "Passkey accounts", ui: <PasskeySheet />, tags: ["Mera", "No seed phrase"], body: "One tap with Face ID and you're in. No extension to install, nothing to write down, works across devices.", href: "/trenches" },
];

const INSIDE: [string, string[]][] = [
  ["Trading", ["Trenches feed", "Trending markets", "Token safety checks", "One-tap quick buy"]],
  ["Social", ["Groups & invite codes", "Friends' trade feed", "Weekly leaderboards", "Follow-the-leader buys"]],
  ["Clubs", ["Pooled USDC", "Captain trading", "Per-trade limits", "Withdraw any time"]],
  ["Accounts", ["Passkey sign-in", "Cross-device recovery", "Session signing", "Monad testnet"]],
];

const STATS: [string, number | null, string, string][] = [
  ["400ms", 400, "ms", "Monad block time"],
  ["800ms", 800, "ms", "To finality"],
  ["0", null, "", "Seed phrases to write down"],
  ["1 tap", null, "", "To sign in"],
];

const FAQ = [
  ["Does Kadd hold my funds?", "No. Your account comes from the passkey on your device, and club funds are held by a contract on Monad. Kadd has no access to your keys and no way to withdraw club funds."],
  ["What if a club's captain disappears?", "Every member can withdraw their share at any time, straight from the contract, without the captain's permission. Captains can only trade approved markets, within a per-trade limit."],
  ["How is this different from gmgn?", "gmgn is a terminal for experienced traders trading alone. Kadd is about trading together: groups, friends' feeds, pooled clubs, and risk explained in plain language."],
  ["Can I use it today?", "Kadd runs on Monad testnet. Passkey sign-in and onchain clubs are live; some token data and trading are still demo until Kuru testnet liquidity is available."],
];

export default function Landing() {
  return (
    <div className="landing overflow-x-clip bg-bg text-fg antialiased">
      <SmoothScroll />
      <LandingNav />
      <Hero />

      <Fx>
        {/* Statement + steps */}
        <section id="how-it-works" className="scroll-mt-24 px-5 py-24 md:px-10 md:py-36">
          <div className="mx-auto max-w-[1400px]">
            <div className="grid gap-8 md:grid-cols-[220px_1fr]">
              <ul className="text-[15px] font-medium leading-6">
                <li>Social</li>
                <li>Onchain</li>
                <li>Passkey-first</li>
              </ul>
              <p data-anim="words" className="max-w-[24ch] text-[clamp(30px,4vw,48px)] font-medium leading-[1.18] tracking-[-0.02em]">
                Kadd works like a group chat for your trades — see what friends buy, copy what works, and pool funds in clubs where the rules live onchain.
              </p>
            </div>

            <div data-anim="rise" className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 md:mt-24">
              {STEPS.map(([title, body], i) => {
                return (
                  <article key={title} data-tilt className="flex min-h-[260px] flex-col justify-between gap-10 rounded-2xl bg-raised p-6 md:min-h-[380px]">
                    <div>
                      <span className="font-mono text-[13px] text-muted">0{i + 1}</span>
                      <h3 className="mt-3 text-[26px] font-medium leading-tight tracking-[-0.02em] md:text-[30px]">{title}</h3>
                    </div>
                    <p className="text-[15px] leading-relaxed text-muted">{body}</p>
                  </article>
                );
              })}
            </div>
            <div className="mt-12 flex justify-center">
              <Cta href="/trenches">Launch app</Cta>
            </div>
          </div>
        </section>

        {/* Tag cloud */}
        <section className="px-5 pb-24 md:px-10 md:pb-32">
          <div data-stickers className="mx-auto grid max-w-[1400px] place-items-center py-10 md:py-20">
            <h2 data-anim="lines" className="text-center text-[clamp(40px,6vw,80px)] font-medium leading-[1.02] tracking-[-0.035em]">
              One terminal,
              <br />
              all your friends
            </h2>
            <div className="mt-10 flex max-w-[760px] flex-wrap justify-center gap-2.5">
              {TAGS.map(([label, color], i) => (
                <span key={label} data-sticker className={`px-3.5 py-1.5 text-[14px] font-semibold text-[#0a0a0a] ${i % 2 ? "rounded-full -rotate-2" : "rounded-md rotate-2"}`} style={{ background: color }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="mx-auto flex max-w-[1400px] justify-between text-[15px] font-medium">
            <span>Built for groups, not whales</span>
            <Link href="/groups" className="underline-offset-4 hover:underline">Start a group</Link>
          </div>
        </section>

        {/* Dark manifesto */}
        <section className="border-t border-line px-5 py-24 md:px-10 md:py-36">
          <div className="mx-auto grid max-w-[1400px] items-center gap-14 lg:grid-cols-[0.8fr_1.2fr]">
            {/* Product UI: weekly leaderboard above the live activity feed. */}
            <div data-tilt className="mx-auto grid w-full max-w-[460px] gap-4">
              <LeaderboardMini />
              <ActivityFeed rows={3} />
            </div>
            <div>
              <p data-anim="words" className="max-w-[22ch] text-[clamp(30px,3.8vw,48px)] font-medium leading-[1.16] tracking-[-0.02em]">
                At Kadd, we believe a small group of friends can out-trade any solo degen — when the tools are built for them.
              </p>
              <h3 data-anim="lines" className="mt-14 text-[clamp(26px,3vw,40px)] font-medium tracking-[-0.02em]">Here&apos;s why it works</h3>
              <dl data-anim="rise" className="mt-6">
                {WHY.map(([k, v]) => (
                  <div key={k} className="grid gap-2 border-t border-line py-5 sm:grid-cols-[200px_1fr] sm:gap-8">
                    <dt className="text-[15px] font-medium">{k}</dt>
                    <dd className="text-[15px] leading-relaxed text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section id="clubs" className="scroll-mt-24 px-5 py-24 md:px-10 md:py-36">
          <div className="mx-auto max-w-[1400px]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 data-anim="lines" className="max-w-[18ch] text-[clamp(34px,4.4vw,56px)] font-normal leading-[1.08] tracking-[-0.035em]">
                Built for trading
                <br />
                with the people you trust
              </h2>
              <Link href="/trenches" className="text-[15px] font-medium underline-offset-4 hover:underline">Open the app</Link>
            </div>
            <div data-anim="rise" className="mt-12 grid gap-4 md:grid-cols-3">
              {FEATURES.map((f) => (
                <Link key={f.title} href={f.href} className="group block">
                  <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl bg-raised p-6">
                    <div data-parallax className="relative w-full max-w-[340px] transition-transform duration-500 group-hover:-translate-y-1.5">
                      {f.ui}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3 text-[13px] text-muted">
                    {f.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <h3 className="mt-1 text-[22px] font-medium tracking-[-0.02em]">{f.title}</h3>
                  <p className="mt-1 max-w-[40ch] text-[15px] leading-relaxed text-muted">{f.body}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* What's inside */}
        <section id="inside" className="scroll-mt-24 border-t border-line px-5 py-24 md:px-10">
          <div className="mx-auto max-w-[1400px]">
            <h2 data-anim="lines" className="text-[clamp(30px,3vw,40px)] font-medium tracking-[-0.02em]">What&apos;s inside</h2>
            <div data-anim="rise" className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {INSIDE.map(([group, items]) => (
                <div key={group}>
                  <h3 className="text-[15px] text-muted">{group}</h3>
                  <ul className="mt-4 grid gap-2 text-[17px] font-medium tracking-[-0.01em]">
                    {items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="px-5 pb-24 md:px-10">
          <div data-anim="rise" className="mx-auto grid max-w-[1400px] grid-cols-2 gap-y-10 border-t border-line pt-10 lg:grid-cols-4">
            {STATS.map(([shown, to, suffix, label]) => (
              <div key={label}>
                <div className="text-[clamp(44px,5.6vw,80px)] font-medium leading-none tracking-[-0.04em] tabular-nums" {...(to ? { "data-count": to, "data-suffix": suffix } : {})}>
                  {shown}
                </div>
                <div className="mt-3 text-[15px] text-muted">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Status (Verteal's pricing cards) */}
        <section className="border-t border-line px-5 py-24 md:px-10 md:py-32">
          <div className="mx-auto max-w-[1400px]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted">Status</p>
            <h2 data-anim="lines" className="mt-3 max-w-[16ch] text-[clamp(34px,4.4vw,56px)] font-medium leading-[1.05] tracking-[-0.03em]">
              Live today, and what ships next
            </h2>
            <div data-anim="rise" className="mt-12 grid gap-4 md:grid-cols-2">
              <div data-tilt className="flex flex-col rounded-2xl bg-raised p-7">
                <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">Live on testnet</span>
                <p className="mt-3 text-[40px] font-medium leading-none tracking-[-0.03em]">Today</p>
                <ul className="mt-8 grid gap-3 text-[15px]">
                  {["Passkey accounts with Mera", "Onchain clubs (KaddClub, verified)", "Groups, feeds and leaderboards", "Trenches & Trending (demo data)"].map((x) => (
                    <li key={x} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" />{x}</li>
                  ))}
                </ul>
                <Cta href="/trenches" className="mt-10 self-start">Launch app</Cta>
              </div>
              <div data-tilt className="flex flex-col rounded-2xl bg-raised p-7">
                <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand">Coming next</span>
                <p className="mt-3 text-[40px] font-medium leading-none tracking-[-0.03em]">Soon</p>
                <ul className="mt-8 grid gap-3 text-[15px]">
                  {["Real trading on Kuru's order book", "Live Monad token data", "Copy trading with capped permissions", "Installable mobile app"].map((x) => (
                    <li key={x} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand" />{x}</li>
                  ))}
                </ul>
                <Cta href="/groups" className="mt-10 self-start">Start a club</Cta>
              </div>
            </div>
            <p className="mt-6 text-[14px] text-muted">Testnet only. Contracts are unaudited.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 px-5 py-24 md:px-10 md:py-32">
          <div className="mx-auto grid max-w-[1400px] gap-10 md:grid-cols-[1fr_1.6fr]">
            <h2 data-anim="lines" className="text-[clamp(34px,4vw,52px)] font-medium tracking-[-0.03em]">Questions</h2>
            <div data-anim="rise">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group border-b border-line first:border-t">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-[18px] font-medium">
                    {q}
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-raised text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="-mt-2 max-w-[60ch] pb-6 leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-5 pb-28 md:px-10 md:pb-40">
          <div className="mx-auto max-w-[1400px] border-t border-line pt-24 text-center">
            <h2 data-anim="lines" className="mx-auto text-[clamp(40px,6vw,84px)] font-medium leading-[1.02] tracking-[-0.04em]">
              <span className="text-faint">You&apos;ve seen the terminal.</span>
              <br />
              Now trade it with friends.
            </h2>
            <p className="mx-auto mt-6 max-w-[48ch] text-[17px] leading-relaxed text-muted">
              Sign in with a passkey in one tap, start a group, and invite the first person you&apos;d trust with a trade idea.
            </p>
            <div className="mt-10 flex justify-center">
              <Cta href="/trenches">Launch app</Cta>
            </div>
          </div>
        </section>
      </Fx>

      {/* Footer */}
      <footer className="border-t border-line px-5 pb-10 pt-16 md:px-10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-16">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <Live />
            <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-[15px] text-muted">
              <Link href="/trenches" className="hover:text-fg">App</Link>
              <Link href="/groups" className="hover:text-fg">Clubs</Link>
              <Link href="/leaderboard" className="hover:text-fg">Leaderboard</Link>
              <a href={`https://testnet.monadexplorer.com/address/${CLUB_FACTORY}`} target="_blank" rel="noreferrer" className="hover:text-fg">Contract</a>
            </nav>
          </div>
          <div className="flex items-end justify-between gap-6">
            <div className="flex items-center gap-3">
              <Logo size={40} />
              <span className="text-[clamp(48px,9vw,140px)] font-medium leading-none tracking-[-0.06em]">kadd</span>
            </div>
            <span className="hidden text-right text-[13px] text-faint sm:block">Built on Monad · Kuru · Mera<br />Testnet, unaudited</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
