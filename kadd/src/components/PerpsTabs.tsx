import Link from "next/link";
import { CandlestickChart, Columns3, ShieldAlert } from "lucide-react";

const TABS = [
  ["trade", "/perps", "Trade", CandlestickChart],
  ["risk", "/perps/risk", "Risk", ShieldAlert],
  ["compare", "/perps/compare", "Compare", Columns3],
] as const;

/** The three Perpl pages as one section: trade from your passkey, the protocol risk dashboard, traders side by side. */
export default function PerpsTabs({ active }: { active: (typeof TABS)[number][0] }) {
  return (
    <nav aria-label="Perps" className="flex items-center gap-1 p-0.5 rounded-lg bg-raised w-fit text-[13px] font-medium">
      {TABS.map(([key, href, label, Icon]) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? "page" : undefined}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md transition-colors ${active === key ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`}
        >
          <Icon className="size-3.5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
