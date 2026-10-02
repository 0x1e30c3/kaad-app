"use client";
import { useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Logo } from "../ui";
import Cta from "./Cta";
import ThemeToggle from "../ThemeToggle";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const LINKS = [
  ["#how-it-works", "How it works"],
  ["#inside", "Inside"],
  ["#clubs", "Clubs"],
  ["#faq", "FAQ"],
];

/** Verteal-style top bar: mark left, links, CTA right. Stays put while scrolling. */
export default function LandingNav() {
  const ref = useRef<HTMLElement>(null);
  useGSAP(() => {
    const bar = ref.current!;
    gsap.from(bar, { y: -30, opacity: 0, duration: 1, ease: "expo.out", delay: 0.2 });
    // Always visible; once past the hero it picks up a soft shadow to lift off the content.
    ScrollTrigger.create({ start: 80, end: "max", toggleClass: { targets: bar, className: "is-scrolled" } });
  });

  return (
    <header ref={ref} className="group/nav fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-5">
      <nav className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 rounded-2xl bg-panel/80 pl-3 pr-1.5 text-fg ring-1 ring-line backdrop-blur-md transition-shadow duration-300 group-[.is-scrolled]/nav:shadow-[0_10px_30px_rgb(0_0_0/0.08)]">
        <Link href="/" className="flex items-center gap-2 pr-3">
          <Logo size={26} />
          <span className="text-[16px] font-semibold tracking-[-0.02em]">kadd</span>
        </Link>
        <div className="hidden md:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-2 text-[14px] text-muted hover:bg-hover hover:text-fg">
              {label}
            </a>
          ))}
        </div>
        <span className="ml-auto" />
        <ThemeToggle />
        <Cta href="/trenches" className="h-10 text-[14px]">
          Launch app
        </Cta>
      </nav>
    </header>
  );
}
