import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { Risk } from "@/lib/mock";

/** The Kaad mark, drawn from /logo/mark.png and tinted by the surrounding text colour. */
export function Logo({ size = 22, className = "" }: { size?: number; className?: string }) {
  return <span aria-hidden className={`logo-mark ${className}`} style={{ width: size, height: size }} />;
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

/** The one container used on data pages: header bar (title · count · actions) over a body of divided rows. */
export function Panel({ title, count, actions, children, className = "" }: { title: React.ReactNode; count?: number | string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-panel overflow-hidden ${className}`}>
      <header className="flex items-center gap-2 h-11 px-4 border-b border-line">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {count !== undefined && <span className="text-[12px] text-faint tabular-nums">{count}</span>}
        {actions && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** One line inside a Panel when there's nothing to list: what's missing, and the one thing to do about it. */
export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-5 text-[13px] text-muted">{children}</p>;
}

export type Stat = { label: string; value: React.ReactNode; note?: React.ReactNode; tone?: "up" | "down" };

/** Key numbers in one divided strip instead of a grid of separate cards. */
export function StatStrip({ stats, className = "" }: { stats: Stat[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-px rounded-lg border border-line bg-line overflow-hidden md:grid-cols-[repeat(var(--n),minmax(0,1fr))] ${className}`} style={{ "--n": stats.length } as React.CSSProperties}>
      {stats.map((s) => (
        <div key={s.label} className="bg-panel px-4 py-3">
          <div className="text-[11px] text-muted">{s.label}</div>
          <div className={`mt-0.5 text-[20px] font-semibold tabular-nums tracking-[-0.02em] ${s.tone === "up" ? "text-up" : s.tone === "down" ? "text-down" : ""}`}>{s.value}</div>
          {s.note && <div className="text-[11px] text-faint tabular-nums">{s.note}</div>}
        </div>
      ))}
    </div>
  );
}

/** Small action button used in Panel headers and table rows. */
export const btnSm = "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-line-strong text-[12px] font-semibold hover:bg-hover disabled:opacity-40";

/** Stable hue for anything with a name or address, so a group/club/token keeps one identity colour everywhere. */
export function hueOf(key: string) {
  let h = 2166136261; // FNV-1a, then spread by the golden angle so similar names still land far apart
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return Math.round(((h >>> 0) * 137.508) % 360);
}

/** Coloured letter tile: the identity mark for groups and clubs. */
export function Monogram({ name, size = 40, hue = hueOf(name) }: { name: string; size?: number; hue?: number }) {
  return (
    <span
      className="shrink-0 grid place-items-center rounded-xl font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 55% 46%)` }}
      aria-hidden
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** "N copying": how many Kadd copy vaults follow a wallet. Renders nothing at 0. */
export function CopyChip({ n, className = "" }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span title={`${n} Kadd copy ${n === 1 ? "vault follows" : "vaults follow"} this wallet`} className={`inline-flex items-center gap-1 h-4 px-1 rounded bg-brand/15 text-[10px] font-semibold text-fg tabular-nums ${className}`}>
      <svg viewBox="0 0 16 16" className="size-2.5" aria-hidden><path fill="currentColor" d="M6 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM0 14c0-2.8 2.7-5 6-5s6 2.2 6 5v1H0v-1Zm13 1v-1c0-1.5-.6-2.9-1.6-3.9 2.3.3 4.6 1.6 4.6 3.9v1h-3Z" /></svg>
      {n} copying
    </span>
  );
}

export function StatusPill({ tone, children }: { tone: "up" | "warn" | "down" | "muted"; children: React.ReactNode }) {
  const cls = { up: "text-up bg-up/10", warn: "text-warn bg-warn/10", down: "text-down bg-down/10", muted: "text-muted bg-raised" }[tone];
  return <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[11px] font-medium whitespace-nowrap ${cls}`}>{children}</span>;
}

/** Card surface used by the "story" cards: identity, headline number, context, one clear action. */
export const card = "relative flex flex-col rounded-xl border border-line bg-panel transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_6px_24px_-12px_rgb(0_0_0/0.25)]";

