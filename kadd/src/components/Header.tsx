"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Layers, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Search from "./Search";
import Account from "./Account";
import { Logo } from "./ui";

const NAV: [string, string, LucideIcon][] = [
  ["/trenches", "Trenches", Layers],
  ["/trending", "Trending", Flame],
  ["/groups", "Groups", Users],
  ["/leaderboard", "Leaderboard", Trophy],
  ["/portfolio", "Portfolio", Wallet],
];

const isActive = (path: string, href: string) =>
  href === "/trenches" ? path.startsWith("/trenches") || path.startsWith("/token") : href === "/groups" ? path.startsWith("/groups") || path.startsWith("/clubs") : path.startsWith(href);

export default function Header() {
  const path = usePathname();
  return (
    <>
      <header className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-line bg-panel">
        <Link href="/" className="flex items-center gap-2 pr-3 mr-1 border-r border-line h-6">
          <Logo />
          <span className="font-semibold text-[15px] tracking-[-0.02em]">kadd</span>
        </Link>
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`h-8 px-3 grid place-items-center rounded-md text-[13px] font-medium ${isActive(path, href) ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Search />
          <span className="hidden lg:flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-line text-[12px] font-medium">
            <span className="size-1.5 rounded-full bg-[#836ef9]" />
            Monad
          </span>
          <ThemeToggle />
          <Account />
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-5 border-t border-line bg-panel/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        {NAV.map(([href, label, Icon]) => (
          <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive(path, href) ? "text-fg" : "text-muted"}`}>
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
