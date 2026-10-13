"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bot, CandlestickChart, Flame, Layers, Menu, Plus, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Search from "./Search";
import Account from "./Account";
import { Logo } from "./ui";

// [href, label, icon, keyboard shortcut]
const NAV: [string, string, LucideIcon, string][] = [
  ["/trenches", "Home", Layers, "1"],
  ["/perps", "Perps", CandlestickChart, "2"],
  ["/trending", "Trending", Flame, "3"],
  ["/groups", "Groups & Clubs", Users, "4"],
  ["/leaderboard", "Leaderboard", Trophy, "5"],
  ["/portfolio", "Portfolio", Wallet, "6"],
  ["/stats", "Stats", BarChart3, "7"],
  ["/agents", "AI Agents", Bot, "8"],
];
// Secondary destinations stay available through More on phones.
const MOBILE = NAV.filter((n) => ["/trenches", "/perps", "/groups", "/portfolio"].includes(n[0]));
const SHORT: Record<string, string> = { "/groups": "Groups", "/agents": "Agents" }; // label where space is tight

const isActive = (path: string, href: string) =>
  href === "/trenches" ? path.startsWith("/trenches") || path.startsWith("/token") : href === "/groups" ? path.startsWith("/groups") || path.startsWith("/clubs") : path.startsWith(href);

/** Number keys 1–8 jump between sections, unless the user is typing. */
function useShortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;
      const hit = NAV.find((n) => n[3] === e.key);
      if (hit) router.push(hit[0]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}

/** Hover/focus label to the right of a sidebar icon. */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span role="tooltip" className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md border border-line bg-panel px-2 py-1 text-[12px] font-medium text-fg shadow-lg opacity-0 -translate-x-1 transition group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0">
      {children}
    </span>
  );
}

/** Desktop: a slim icon rail on the left — every section, the primary action, and the theme switch. */
export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden md:flex w-14 shrink-0 flex-col items-center gap-1 py-2.5 border-r border-line bg-panel">
      <Link href="/" aria-label="Kadd home" className="grid place-items-center size-10 mb-2">
        <Logo size={26} />
      </Link>
      <nav aria-label="Main" className="flex flex-col items-center gap-1">
        {NAV.map(([href, label, Icon, key]) => {
          const on = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              aria-label={label}
              className={`group relative grid place-items-center size-10 rounded-lg transition-colors ${on ? "bg-raised text-fg" : "text-muted hover:text-fg hover:bg-hover"}`}
            >
              {on && <span className="absolute -left-2 inset-y-2.5 w-0.5 rounded-full bg-brand" />}
              <Icon className="size-[18px]" />
              <Tip>
                {label} <kbd className="ml-1 font-mono text-[10px] text-faint">{key}</kbd>
              </Tip>
            </Link>
          );
        })}
      </nav>
      <Link href="/start" aria-label="Copy your first wallet" className="group relative mt-2 grid place-items-center size-10 rounded-lg bg-brand-fill text-[#0a0a0a] hover:brightness-95">
        <Plus className="size-5" />
        <Tip>Copy your first wallet</Tip>
      </Link>
      <div className="mt-auto">
        <ThemeToggle />
      </div>
    </aside>
  );
}

export default function Header() {
  const path = usePathname();
  useShortcuts();
  return (
    <>
      <header className="h-14 shrink-0 flex items-center gap-2 px-3 md:px-4 border-b border-line bg-panel">
        <Link href="/" aria-label="Kadd home" className="md:hidden flex items-center">
          <Logo size={24} />
        </Link>
        <div className="min-w-0 flex-1 flex items-center">
          <Search />
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/start" aria-label="Copy your first wallet" title="Copy your first wallet" className="hidden md:grid place-items-center size-9 rounded-md border border-line text-muted hover:text-fg hover:bg-hover">
            <Plus className="size-4" />
          </Link>
          <div className="md:hidden">
            <ThemeToggle />
          </div>
          <Account />
        </div>
      </header>

      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-5 border-t border-line bg-panel/95 backdrop-blur h-[var(--mobile-nav-height)] pb-[env(safe-area-inset-bottom)]">
        {MOBILE.map(([href, label, Icon]) => {
          const on = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center gap-1 pt-2 pb-1.5 text-[10px] ${on ? "text-fg font-semibold" : "text-muted font-medium"}`}
            >
              <span className={`relative grid place-items-center h-7 w-12 rounded-full transition-colors ${on ? "bg-brand-fill/20 text-fg" : ""}`}>
                <Icon className="size-[18px]" />
              </span>
              {SHORT[href] ?? label}
            </Link>
          );
        })}
        <MoreNav path={path} />
      </nav>
    </>
  );
}

function MoreNav({ path }: { path: string }) {
  return (
    <details className="relative" onKeyDown={(e) => {
      if (e.key === "Escape") { e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus(); }
    }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false; }}>
      <summary className="cursor-pointer list-none flex flex-col items-center justify-center gap-1 h-[60px] text-[10px] text-muted rounded-md hover:bg-hover">
        <Menu className="size-4" /> More
      </summary>
      <nav aria-label="All sections" className="absolute right-0 bottom-full mb-2 z-40 w-56 max-h-[60dvh] overflow-auto rounded-lg border border-line bg-panel p-1 shadow-xl">
        {NAV.map(([href, label, Icon]) => <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}
          onClick={(e) => { const d = e.currentTarget.closest("details"); if (d) d.open = false; }}
          className={`flex items-center gap-2 min-h-11 px-3 rounded-md hover:bg-hover ${isActive(path, href) ? "bg-raised font-semibold" : "text-muted"}`}><Icon className="size-4" />{label}</Link>)}
      </nav>
    </details>
  );
}
