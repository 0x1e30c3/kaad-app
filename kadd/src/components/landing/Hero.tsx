"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Fingerprint, Search, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Cta from "./Cta";
import Chart from "../Chart";
import { Logo } from "../ui";
import { GROUPS, TOKENS, candles, groupFeed, num, pct, usd, type Risk } from "@/lib/mock";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

const LIST = TOKENS.filter((t) => t.mc > 250_000).slice(0, 6);
const FEED = groupFeed(GROUPS[0].members, 4);
const RISK: Record<Risk, [string, string]> = { safe: ["Safe", "text-up"], caution: ["Caution", "text-warn"], danger: ["Risky", "text-down"] };

/**
 * Product-first hero: a short centred pitch, then the terminal itself — pick a token, see its chart, place a
 * demo order and watch it land in your club's feed. On scroll the window tilts flat (perspective → 0).
 */
export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(q("[data-title]")[0], { type: "lines", mask: "lines" });
        gsap
          .timeline({ defaults: { ease: "expo.out" } })
          .from(q("[data-chip]"), { y: 14, opacity: 0, duration: 0.8 }, 0.1)
          .from(split.lines, { yPercent: 115, duration: 1.2, stagger: 0.08 }, 0.15)
          .from(q("[data-sub]"), { y: 20, opacity: 0, duration: 1 }, 0.45)
          .from(q("[data-frame]"), { y: 80, opacity: 0, duration: 1.4 }, 0.55);
        gsap.fromTo(
          q("[data-frame]"),
          { rotationX: 16, transformPerspective: 1600, transformOrigin: "50% 0%" },
          { rotationX: 0, ease: "none", scrollTrigger: { trigger: q("[data-frame]")[0], start: "top 85%", end: "top 25%", scrub: 1 } },
        );
        return () => split.revert();
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="bg-bg px-5 pb-20 pt-32 text-fg md:px-10 md:pt-40">
      <div className="mx-auto flex max-w-[860px] flex-col items-center text-center">
        <a
          data-chip
          href="/perps"
          className="group inline-flex items-center gap-2 rounded-full bg-raised py-1 pl-1 pr-3 text-[13px] ring-1 ring-line hover:bg-hover"
        >
          <span className="rounded-full bg-brand-fill px-2 py-0.5 text-[11px] font-semibold text-[#0a0a0a]">New</span>
          Perps on Perpl, from your passkey
          <ArrowUpRight className="size-3.5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
        <h1 data-title className="mt-7 text-[clamp(40px,6.4vw,84px)] font-medium leading-[1.04] tracking-[-0.035em]">
          The trading terminal you share with friends
        </h1>
        <div data-sub className="flex flex-col items-center">
          <p className="mt-6 max-w-[52ch] text-[17px] leading-[1.5] text-muted md:text-[18px]">
            See who&apos;s actually winning on Monad, check their risk, and follow them with limits a contract enforces: spot or perps, alone or with friends. Sign in with a passkey — no seed phrase.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Cta href="/start">Try it in 60 seconds</Cta>
            <Link href="/trenches" className="h-11 rounded-full px-5 text-[15px] font-medium leading-[44px] text-muted ring-1 ring-line hover:bg-raised hover:text-fg">
              Launch app
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-muted">
            {["Passkey sign-in", "Live Monad data", "Withdraw any time"].map((x) => (
              <li key={x} className="flex items-center gap-1.5"><Check className="size-3.5 text-up" />{x}</li>
            ))}
          </ul>
        </div>
      </div>

      <div data-frame className="mx-auto mt-16 max-w-[1240px] md:mt-20">
        <Terminal />
        <p className="mt-3 text-center text-[12px] text-faint">Interactive preview with demo data — pick a token and place an order.</p>
      </div>
    </section>
  );
}

function Terminal() {
  const [sel, setSel] = useState(LIST[0]);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState(50);
  const [mine, setMine] = useState<{ id: number; token: string; side: "buy" | "sell"; usd: number }[]>([]);
  const data = useMemo(() => candles(sel, 120), [sel]);
  const [riskLabel, riskColor] = RISK[sel.risk];
  const RiskIcon = sel.risk === "safe" ? ShieldCheck : ShieldAlert;
  const buy = side === "buy";

  const feed = [
    ...mine.map((m) => ({ key: `m${m.id}`, name: "you", hue: 75, side: m.side, token: m.token, usd: m.usd, when: "now" })),
    ...FEED.map((f, i) => ({ key: `f${i}`, name: f.trader.name, hue: f.trader.hue, side: f.side, token: f.token.symbol, usd: f.usd, when: `${f.agoMin || 1}m` })),
  ].slice(0, 4);

  return (
    <div className="overflow-hidden rounded-2xl bg-panel text-left text-[13px] shadow-[0_30px_80px_rgb(0_0_0/0.08)] ring-1 ring-line">
      {/* App bar */}
      <div className="flex h-12 items-center gap-3 border-b border-line px-3">
        <span className="flex items-center gap-2 font-semibold"><Logo size={22} /> kadd</span>
        <span className="ml-3 hidden h-8 w-64 items-center gap-2 rounded-lg bg-raised px-2.5 text-muted md:flex">
          <Search className="size-3.5" /> Search token or address
          <kbd className="ml-auto rounded bg-panel px-1.5 text-[11px] ring-1 ring-line">/</kbd>
        </span>
        <nav className="hidden gap-1 lg:flex">
          {["Trenches", "Trending", "Clubs", "Leaderboard"].map((x, i) => (
            <span key={x} className={`rounded-md px-2.5 py-1 ${i ? "text-muted" : "bg-raised font-medium"}`}>{x}</span>
          ))}
        </nav>
        <span className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-fg px-3 font-medium text-bg">
          <Fingerprint className="size-3.5" /> Sign in
        </span>
      </div>

      {/* Mobile token picker */}
      <div className="flex gap-2 overflow-x-auto border-b border-line p-2.5 lg:hidden">
        {LIST.map((t) => (
          <button key={t.address} onClick={() => setSel(t)} className={`shrink-0 rounded-full px-3 py-1 ring-1 ${t === sel ? "bg-fg text-bg ring-fg" : "ring-line"}`}>
            {t.symbol} <span className={t === sel ? "" : t.change1h >= 0 ? "text-up" : "text-down"}>{pct(t.change1h)}</span>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        {/* Trenches list */}
        <div className="hidden border-r border-line lg:block">
          <div className="flex items-center justify-between px-3 pb-1 pt-3 text-[12px] text-muted">
            <span className="font-medium text-fg">Trenches</span> New pairs
          </div>
          <ul className="p-1.5">
            {LIST.map((t) => (
              <li key={t.address}>
                <button onClick={() => setSel(t)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-raised ${t === sel ? "bg-raised" : ""}`}>
                  <Avatar label={t.symbol} hue={t.hue} square />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">{t.symbol}</span>
                    <span className="block text-[11px] text-muted">MC {usd(t.mc)}</span>
                  </span>
                  <span className={`tabular-nums font-medium ${t.change1h >= 0 ? "text-up" : "text-down"}`}>{pct(t.change1h)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Token */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
            <Avatar label={sel.symbol} hue={sel.hue} square />
            <div>
              <div className="font-semibold leading-tight">{sel.symbol}<span className="ml-1.5 font-normal text-muted">{sel.name}</span></div>
              <div className={`flex items-center gap-1 text-[11px] ${riskColor}`}><RiskIcon className="size-3" /> {riskLabel}</div>
            </div>
            <div className="ml-auto text-right tabular-nums">
              <div className="text-[16px] font-semibold leading-tight">{usd(sel.mc)}</div>
              <div className={`text-[12px] font-medium ${sel.change1h >= 0 ? "text-up" : "text-down"}`}>{pct(sel.change1h)} 1h</div>
            </div>
          </div>
          <div className="h-[240px] px-1 md:h-[300px]">
            <Chart key={sel.address} data={data} />
          </div>
          <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
            {[["Liquidity", usd(sel.liq)], ["Vol 24h", usd(sel.vol24h)], ["Holders", num(sel.holders)], ["Top 10", `${sel.top10}%`]].map(([k, v]) => (
              <div key={k} className="bg-panel px-4 py-2.5">
                <dt className="text-[11px] text-muted">{k}</dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Ticket + club feed */}
        <div className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-1 lg:content-start lg:border-l lg:border-t-0">
          <div className="p-3">
            <div className="grid grid-cols-2 rounded-lg bg-raised p-0.5 font-semibold">
              {(["buy", "sell"] as const).map((s) => (
                <button key={s} onClick={() => setSide(s)} className={`h-8 rounded-md capitalize ${side === s ? `bg-panel shadow-sm ${s === "buy" ? "text-up" : "text-down"}` : "text-muted"}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex items-baseline justify-between rounded-lg bg-raised px-3 py-2">
              <span className="text-[20px] font-semibold tabular-nums">{amt}</span>
              <span className="text-[12px] text-muted">USDC</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[10, 25, 50, 100].map((p) => (
                <button key={p} onClick={() => setAmt(p)} className={`h-7 rounded-md text-[12px] font-medium tabular-nums ring-1 ${amt === p ? "ring-fg" : "text-muted ring-line hover:text-fg"}`}>
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMine((m) => [{ id: Date.now(), token: sel.symbol, side, usd: amt }, ...m].slice(0, 2))}
              className={`mt-2.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg font-semibold text-white active:scale-[0.98] ${buy ? "bg-up" : "bg-down"}`}
            >
              <Zap className="size-3.5 fill-current" /> {buy ? "Buy" : "Sell"} {sel.symbol}
            </button>
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted">
              {mine.length ? <><Check className="size-3 text-up" /> Demo order shared with your club</> : <><Fingerprint className="size-3" /> Signed with your passkey</>}
            </p>
          </div>
          <div className="border-line p-3 sm:border-l lg:border-l-0 lg:border-t">
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="font-medium">Campus club</span>
              <span className="flex items-center gap-1 text-muted"><span className="size-1.5 animate-pulse rounded-full bg-up" /> 6 members</span>
            </div>
            <ul className="grid gap-0.5">
              {feed.map((f) => (
                <li key={f.key} className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 ${f.name === "you" ? "animate-[slidein_.4s_ease-out] bg-raised" : ""}`}>
                  <Avatar label={f.name} hue={f.hue} />
                  <span className="min-w-0 flex-1 truncate">
                    <b className="font-semibold">{f.name}</b> <span className={f.side === "buy" ? "text-up" : "text-down"}>{f.side === "buy" ? "bought" : "sold"}</span> {f.token}
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-medium leading-tight">${f.usd}</span>
                    <span className="block text-[10px] text-muted">{f.when}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ label, hue, square = false }: { label: string; hue: number; square?: boolean }) {
  return (
    <span className={`grid size-7 shrink-0 place-items-center text-[10px] font-bold text-white ${square ? "rounded-lg" : "rounded-full"}`} style={{ background: `hsl(${hue} 50% 46%)` }}>
      {label.slice(0, 2).toUpperCase()}
    </span>
  );
}
