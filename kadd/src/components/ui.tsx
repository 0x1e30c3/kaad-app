import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { Risk } from "@/lib/mock";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6" fill="var(--brand-fill)" />
      <path d="M8 6v12M8 12l7-6M10.5 10l5 8" stroke="#0e1013" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export { default as TokenIcon } from "./TokenIcon";

const RISK: Record<Risk, [string, string, typeof ShieldCheck]> = {
  safe: ["Low risk", "text-up bg-up/10", ShieldCheck],
  caution: ["Caution", "text-warn bg-warn/10", ShieldQuestion],
  danger: ["High risk", "text-down bg-down/10", ShieldAlert],
};

export function RiskBadge({ risk, compact }: { risk: Risk; compact?: boolean }) {
  const [label, cls, Icon] = RISK[risk];
  return (
    <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium ${cls}`} title={`Risk: ${label}`}>
      <Icon className="size-3" />
      {!compact && label}
    </span>
  );
}

export function Pct({ v, className = "" }: { v: number; className?: string }) {
  return (
    <span className={`tabular-nums ${v >= 0 ? "text-up" : "text-down"} ${className}`}>
      {(v > 0 ? "+" : "") + v.toFixed(1)}%
    </span>
  );
}

export function TraderAvatar({ name, hue, size = 28 }: { name: string; hue: number; size?: number }) {
  return (
    <span
      className="shrink-0 rounded-full grid place-items-center font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 42% 44%)` }}
      aria-hidden
    >
      {name[0].toUpperCase()}
    </span>
  );
}

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
        {desc && <p className="text-muted">{desc}</p>}
      </div>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}
