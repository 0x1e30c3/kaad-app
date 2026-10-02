"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Flame, Layers, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Search from "./Search";
import Account from "./Account";
import { Logo } from "./ui";

// [href, label, icon, keyboard shortcut, shows a live dot]
const NAV: [string, string, LucideIcon, string, boolean?][] = [
  ["/trenches", "Trenches", Layers, "1", true],
  ["/trending", "Trending", Flame, "2"],
  ["/groups", "Groups & Clubs", Users, "3"],
  ["/leaderboard", "Leaderboard", Trophy, "4"],
  ["/portfolio", "Portfolio", Wallet, "5"],
];
const SHORT: Record<string, string> = { "/groups": "Groups" }; // label where space is tight

const isActive = (path: string, href: string) =>
  href === "/trenches" ? path.startsWith("/trenches") || path.startsWith("/token") : href === "/groups" ? path.startsWith("/groups") || path.startsWith("/clubs") : path.startsWith(href);

/** Number keys 1–5 jump between sections, unless the user is typing. */
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
          {NAV.map(([href, label, Icon, key, live]) => {
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
                <span className="relative hidden lg:inline xl:hidden">{SHORT[href] ?? label}</span>
                <span className="relative hidden xl:inline">{label}</span>
                {live && <span className="relative size-1.5 rounded-full bg-up animate-pulse" title="Live data" />}
                {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-fg" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Search />
          <span
            title="Your account and Clubs run on Monad testnet. Token prices and charts are live Monad mainnet data."
            className="hidden xl:flex items-center gap-1.5 h-8 px-2 text-[12px] text-muted cursor-help"
          >
            <span className="size-1.5 rounded-full bg-[#836ef9]" />
            Monad testnet
          </span>
          <ThemeToggle />
          <Account />
        </div>
      </header>

      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-5 border-t border-line bg-panel/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        {NAV.map(([href, label, Icon, , live]) => {
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
                {live && <span className="absolute top-1 right-3 size-1.5 rounded-full bg-up" />}
              </span>
              {SHORT[href] ?? label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
