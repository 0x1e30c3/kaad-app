"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bot, CandlestickChart, Flame, Layers, Menu, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Search from "./Search";
import Account from "./Account";
import { Logo } from "./ui";

// [href, label, icon, keyboard shortcut]
const NAV: [string, string, LucideIcon, string][] = [
  ["/trenches", "Trenches", Layers, "1"],
  ["/perps", "Perps", CandlestickChart, "2"],
  ["/trending", "Trending", Flame, "3"],
  ["/groups", "Groups & Clubs", Users, "4"],
  ["/leaderboard", "Leaderboard", Trophy, "5"],
  ["/portfolio", "Portfolio", Wallet, "6"],
  ["/stats", "Stats", BarChart3, "7"],
  ["/agents", "AI Agents", Bot, "8"],
];
// Secondary destinations stay available through More at every viewport.
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

export default function Header() {
  const path = usePathname();
  useShortcuts();
  return (
    <>
      <header className="h-12 shrink-0 flex items-stretch gap-2 px-3 border-b border-line bg-panel">
        <Link href="/trenches" aria-label="Kadd home" className="flex items-center gap-2 pr-3 mr-1">
          <Logo />
          <span className="font-semibold text-[15px] tracking-[-0.02em]">kadd</span>
        </Link>
        <nav aria-label="Main" className="hidden md:flex items-stretch gap-0.5 lg:gap-1">
          {NAV.filter((n) => ["/trenches", "/perps", "/trending"].includes(n[0])).map(([href, label, Icon, key]) => {
            const on = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                title={`${label} (press ${key})`}
                className={`group relative flex items-center gap-1.5 px-2.5 text-[13px] font-medium ${on ? "text-fg" : "text-muted hover:text-fg"}`}
              >
                <span className={`absolute inset-x-0.5 inset-y-2 rounded-md transition-colors ${on ? "" : "group-hover:bg-hover"}`} />
                <Icon className="relative size-4" />
                <span className="relative hidden lg:inline 2xl:hidden whitespace-nowrap">{SHORT[href] ?? label}</span>
                <span className="relative hidden 2xl:inline whitespace-nowrap">{label}</span>

                {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-fg" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto min-w-0 flex items-center gap-1.5">
          <Search />
          <div className="hidden md:block"><MoreNav path={path} /></div>
          <ThemeToggle />
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
              <span className={`relative grid place-items-center h-7 w-12 rounded-full transition-colors ${on ? "bg-raised" : ""}`}>
                <Icon className="size-[18px]" />

              </span>
              {SHORT[href] ?? label}
            </Link>
          );
        })}
        <MoreNav path={path} mobile />
      </nav>
    </>
  );
}

function MoreNav({ path, mobile = false }: { path: string; mobile?: boolean }) {
  return (
    <details className="relative" onKeyDown={(e) => {
      if (e.key === "Escape") { e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus(); }
    }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false; }}>
      <summary className={`cursor-pointer list-none flex items-center justify-center gap-1 text-muted rounded-md hover:bg-hover ${mobile ? "flex-col h-[60px] text-[10px]" : "h-8 px-2 text-[12px]"}`}>
        <Menu className="size-4" /> More
      </summary>
      <nav aria-label="All sections" className={`absolute right-0 z-40 w-56 max-h-[60dvh] overflow-auto rounded-lg border border-line bg-panel p-1 shadow-xl ${mobile ? "bottom-full mb-2" : "top-full mt-2"}`}>
        {NAV.map(([href, label, Icon]) => <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}
          onClick={(e) => { const d = e.currentTarget.closest("details"); if (d) d.open = false; }}
          className={`flex items-center gap-2 min-h-11 px-3 rounded-md hover:bg-hover ${isActive(path, href) ? "bg-raised font-semibold" : "text-muted"}`}><Icon className="size-4" />{label}</Link>)}
      </nav>
    </details>
  );
}
