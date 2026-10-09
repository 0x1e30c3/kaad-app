import Link from "next/link";
import { ArrowRight } from "lucide-react";

const TONES = {
  dark: "bg-fg text-bg hover:opacity-90",
  light: "bg-white text-[#0a0a0a] hover:bg-white/90",
  outline: "text-fg ring-1 ring-line-strong hover:bg-hover",
  ghost: "text-white ring-1 ring-white/25 hover:bg-white/10",
} as const;

/**
 * Rounded action: a label, optionally followed by a small circled arrow (the reference's "View More ⊙").
 * `magnetic` makes it lean toward the pointer (Fx's data-magnetic).
 */
export default function Pill({ href, children, tone = "dark", arrow = false, magnetic = false, className = "" }: { href: string; children: React.ReactNode; tone?: keyof typeof TONES; arrow?: boolean; magnetic?: boolean; className?: string }) {
  const external = href.startsWith("http");
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      {...(magnetic ? { "data-magnetic": "" } : {})}
      className={`group inline-flex h-11 items-center gap-2 rounded-full text-[14px] font-medium transition-colors ${arrow ? "pl-5 pr-1.5" : "px-5"} ${TONES[tone]} ${className}`}
    >
      {children}
      {arrow && (
        <span className={`grid size-8 place-items-center rounded-full ${tone === "dark" ? "bg-bg text-fg" : tone === "light" ? "bg-[#0a0a0a] text-white" : "bg-fg text-bg"}`}>
          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      )}
    </Link>
  );
}
