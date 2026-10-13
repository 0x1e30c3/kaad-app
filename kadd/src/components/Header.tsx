"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, BarChart3, Bot, CandlestickChart, Flame, Layers, Menu, Trophy, Users, Wallet, X, type LucideIcon } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Search from "./Search";
import Account from "./Account";
import { Logo } from "./ui";

const NAV: [string, string, LucideIcon, string][] = [
  ["/trenches", "Trenches", Layers, "1"],
  ["/trending", "Trending", Flame, "3"],
  ["/perps", "Perps", CandlestickChart, "2"],
  ["/portfolio", "Portfolio", Wallet, "6"],
  ["/groups", "Groups & Clubs", Users, "4"],
  ["/leaderboard", "Leaderboard", Trophy, "5"],
  ["/stats", "Stats", BarChart3, "7"],
  ["/agents", "AI Agents", Bot, "8"],
];
const isActive = (path: string, href: string) => href === "/trenches"
  ? path.startsWith("/trenches") || path.startsWith("/token")
  : href === "/groups" ? path.startsWith("/groups") || path.startsWith("/clubs") : path.startsWith(href);

function Navigation({ compact = false, close }: { compact?: boolean; close?: () => void }) {
  const path = usePathname();
  return <nav aria-label="Main navigation" className="flex flex-col gap-1">
    {NAV.map(([href, label, Icon, key], i) => <Link key={href} href={href} onClick={close}
      aria-current={isActive(path, href) ? "page" : undefined} title={`${label} (press ${key})`}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${i === 4 ? "mt-5" : ""} ${compact ? "justify-center xl:justify-start" : ""} ${isActive(path, href) ? "bg-brand-fill/15 text-brand" : "text-muted hover:bg-hover hover:text-fg"}`}>
      <Icon className="size-[19px] shrink-0" />
      <span className={compact ? "sr-only xl:not-sr-only" : ""}>{label}</span>
    </Link>)}
  </nav>;
}

export function Sidebar() {
  return <aside className="hidden md:flex w-[var(--sidebar-width)] shrink-0 flex-col border-r border-line bg-panel px-3 py-5">
    <Link href="/" aria-label="Kadd landing page" className="mb-8 flex h-9 items-center justify-center gap-2.5 xl:justify-start xl:px-3">
      <Logo size={30} /><span className="hidden xl:inline text-[23px] font-bold tracking-[-0.06em]">kadd<span className="text-brand">.</span></span>
    </Link>
    <div className="min-h-0 flex-1 overflow-y-auto"><Navigation compact /></div>
    <div className="hidden xl:block mt-6 border-t border-line pt-4 px-3">
      <p className="text-[11px] font-semibold text-fg">Your edge on Monad</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">Discover tokens. Practice your next move.</p>
      <Link href="/" className="mt-4 inline-flex min-h-9 items-center gap-1 text-[12px] text-muted hover:text-fg">About Kadd <ArrowUpRight className="size-3" /></Link>
    </div>
  </aside>;
}

export default function Header() {
  const path = usePathname();
  const router = useRouter();
  const drawer = useRef<HTMLDialogElement>(null);
  const title = NAV.find(([href]) => isActive(path, href))?.[1] ?? "Workspace";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (document.querySelector("dialog[open]") || e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(el.tagName) || el.isContentEditable) return;
      const hit = NAV.find((n) => n[3] === e.key);
      if (hit) router.push(hit[0]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return <>
    <header className="h-16 shrink-0 flex items-center gap-2 px-3 md:px-5 border-b border-line bg-panel">
      <Link href="/" aria-label="Kadd landing page" className="md:hidden flex items-center gap-2"><Logo size={27} /><span className="font-bold text-[18px] tracking-tight">kadd</span></Link>
      <span className="hidden md:block text-[13px] text-muted">Workspace <span className="px-2 text-faint">/</span> <span className="text-fg font-medium">{title}</span></span>
      <div className="ml-auto min-w-0 flex items-center gap-1.5 sm:gap-3"><Search /><ThemeToggle /><Account /></div>
    </header>
    <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-line bg-panel h-[var(--mobile-nav-height)] pb-[var(--safe-area-bottom)]">
      {NAV.slice(0, 4).map(([href, label, Icon]) => <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}
        className={`flex flex-col justify-center items-center gap-1 text-[10px] ${isActive(path, href) ? "text-brand font-semibold" : "text-muted"}`}><Icon className="size-5" />{label}</Link>)}
      <button onClick={() => drawer.current?.showModal()} aria-label="Open all navigation" className="flex flex-col justify-center items-center gap-1 text-[10px] text-muted"><Menu className="size-5" />More</button>
    </nav>
    <dialog ref={drawer} aria-label="Navigation" onClick={(e) => { if (e.target === drawer.current) drawer.current?.close(); }}
      className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r border-line bg-panel text-fg p-0 backdrop:bg-black/50">
      <div className="flex h-full flex-col p-4">
        <div className="mb-6 flex items-center justify-between"><Link href="/" onClick={() => drawer.current?.close()} aria-label="Kadd landing page" className="flex items-center gap-2 text-xl font-bold"><Logo size={28} />kadd</Link><button autoFocus aria-label="Close navigation" onClick={() => drawer.current?.close()} className="size-11 grid place-items-center rounded-lg hover:bg-hover"><X className="size-5" /></button></div>
        <div className="overflow-auto"><Navigation close={() => drawer.current?.close()} /></div>
        <Link href="/" onClick={() => drawer.current?.close()} className="mt-auto pt-6 text-muted">About Kadd ↗</Link>
      </div>
    </dialog>
  </>;
}
