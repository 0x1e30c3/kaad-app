"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Logo } from "../ui";
import Pill from "./Pill";
import ThemeToggle from "../ThemeToggle";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const LINKS = [
  ["#terminal", "Terminal"],
  ["#why", "Why Kadd"],
  ["#features", "Features"],
  ["#start", "Get started"],
  ["/stats", "Stats"],
];

/**
 * Mark left, links centred, sign-in pill right. Transparent over the hero, a soft bar once you scroll; the link of
 * the section in view is highlighted, and a thin bar along the top shows how far down the page you are.
 */
export default function LandingNav() {
  const ref = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  useGSAP(() => {
    gsap.from(ref.current, { y: -20, opacity: 0, duration: 0.9, ease: "expo.out", delay: 0.1 });
    ScrollTrigger.create({ start: 60, end: "max", toggleClass: { targets: ref.current, className: "is-scrolled" } });
    gsap.fromTo(bar.current, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
    for (const [href] of LINKS) {
      const el = href.startsWith("#") ? document.querySelector<HTMLElement>(href) : null;
      if (el) ScrollTrigger.create({ trigger: el, start: "top 55%", end: "bottom 55%", onToggle: (st) => setActive((a) => (st.isActive ? href : a === href ? null : a)) });
    }
  });

  return (
    <header ref={ref} className="fixed inset-x-0 top-0 z-50 transition-colors duration-300 [&.is-scrolled]:bg-bg/80 [&.is-scrolled]:backdrop-blur-md [&.is-scrolled]:shadow-[0_1px_0_var(--line)]">
      <nav className="mx-auto flex h-16 max-w-[1280px] items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2 justify-self-start">
          <Logo size={24} />
          <span className="text-[16px] font-semibold tracking-[-0.02em]">kadd</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              aria-current={active === href ? "location" : undefined}
              className={`rounded-full px-3.5 py-2 text-[13px] transition-colors hover:text-fg ${active === href ? "bg-raised text-fg" : "text-muted"}`}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5 justify-self-end">
          <ThemeToggle />
          <Pill href="/trenches" tone="outline" className="h-9 px-4 text-[13px]">
            Launch app
          </Pill>
        </div>
      </nav>
      <div ref={bar} aria-hidden className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-[#836ef9]" />
    </header>
  );
}
