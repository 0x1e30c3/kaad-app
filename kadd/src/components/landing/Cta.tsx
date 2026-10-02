import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/** Verteal's button: a rounded label chip glued to a square accent arrow; the arrow nudges on hover. */
export default function Cta({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={`group inline-flex items-stretch h-11 text-[15px] font-medium ${className}`}>
      <span className={`grid place-items-center px-5 rounded-full bg-raised text-fg ring-1 ring-line transition-colors group-hover:bg-hover`}>{children}</span>
      <span className="grid place-items-center w-11 rounded-[10px] bg-[#c6ee2e] text-[#0a0a0a]">
        <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  );
}
