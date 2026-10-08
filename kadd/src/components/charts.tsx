"use client";
// Small dependency-free SVG charts for data pages: an area/line chart with hover read-out, and a half-circle gauge.
import { useId, useRef, useState } from "react";

export type Point = { t: number; v: number }; // t = unix seconds

/** Value formats a server component can name (it can't pass a function to this client component). */
const KINDS = {
  usd: (v: number) => (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }),
  pnl: (v: number) => (v >= 0 ? "+$" : "-$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }),
  price: (v: number) => "$" + v.toLocaleString("en-US", { maximumSignificantDigits: 4 }),
};

/** Tooltip caption for n evenly spaced points that end now and span `days`. */
export const agoLabel = (days: number, n = 8) => (i: number) => {
  const s = (days * 86400 * (n - 1 - i)) / (n - 1);
  return s === 0 ? "Now" : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};

/** Smooth path through points (Catmull-Rom → cubic Bézier), clamped so curves never overshoot the data range. */
function smooth(xy: [number, number][]) {
  if (xy.length < 2) return "";
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const [x0, y0] = xy[i - 1] ?? xy[i];
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[i + 1];
    const [x3, y3] = xy[i + 2] ?? xy[i + 1];
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    const c1y = Math.min(hi, Math.max(lo, y1 + (y2 - y0) / 6));
    const c2y = Math.min(hi, Math.max(lo, y2 - (y3 - y1) / 6));
    d += ` C${x1 + (x2 - x0) / 6},${c1y} ${x2 - (x3 - x1) / 6},${c2y} ${x2},${y2}`;
  }
  return d;
}

const timeLabel = (t: number, span: number) =>
  new Date(t * 1000).toLocaleString("en-GB", span > 2 * 86400 ? { day: "numeric", month: "short" } : { hour: "2-digit", minute: "2-digit" });

/**
 * Responsive area chart: dotted gridlines, y labels on the right, time labels below, optional bars underneath
 * (e.g. volume), and a crosshair read-out on hover. Colour follows the trend unless given.
 */
export function AreaChart({
  data,
  bars,
  height = 260,
  kind,
  format = kind ? KINDS[kind] : (v: number) => v.toLocaleString("en-US"),
  color,
  fill = true,
  axes = true,
  empty,
  barLabel = "Bar",
  label,
}: {
  data: Point[];
  bars?: number[];
  height?: number;
  kind?: keyof typeof KINDS;
  format?: (v: number) => string;
  color?: string;
  fill?: boolean;
  axes?: boolean;
  empty?: React.ReactNode;
  barLabel?: string;
  /** Tooltip caption for point i; defaults to its time. */
  label?: (i: number) => string;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = height;
  const padR = axes ? 64 : 0;
  const padB = axes ? 26 : 0;
  const barH = bars ? Math.round(H * 0.18) : 0;
  const plotH = H - padB - barH - 8;
  const vs = data.map((p) => p.v);
  const min = Math.min(...vs, 0);
  const max = Math.max(...vs, 0);
  const span = max - min || 1;
  const x = (i: number) => (data.length > 1 ? (i / (data.length - 1)) * (W - padR) : 0);
  const y = (v: number) => 6 + (1 - (v - min) / span) * (plotH - 6);
  const xy = data.map((p, i) => [x(i), y(p.v)] as [number, number]);
  const up = vs.length > 1 && vs[vs.length - 1] >= vs[0];
  const stroke = color ?? (max === min ? "var(--faint)" : up ? "var(--up)" : "var(--down)");
  const line = smooth(xy);
  const ticks = [max, min + span / 2, min];
  const tspan = data.length > 1 ? data[data.length - 1].t - data[0].t : 0;
  const isEmpty = data.length < 2 || max === min;
  const barMax = bars ? Math.max(...bars, 0) : 0;

  const onMove = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || data.length < 2) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round((px / (W - padR)) * (data.length - 1)))));
  };
  const h = hover === null ? null : data[hover];

  return (
    <div ref={box} className="relative select-none" style={{ height: H }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {axes &&
          ticks.map((v, i) => <line key={i} x1={0} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--line-strong)" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />)}
        {fill && !isEmpty && <path d={`${line} L${xy[xy.length - 1][0]},${plotH} L0,${plotH} Z`} fill={stroke} opacity={0.1} />}
        <path id={id} d={line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {bars &&
          bars.map((b, i) => {
            const bw = (W - padR) / bars.length;
            const bh = barMax > 0 ? (b / barMax) * barH : 0;
            return <rect key={i} x={i * bw + bw * 0.15} width={bw * 0.7} y={H - padB - bh} height={bh} fill="var(--fg)" opacity={hover === i ? 0.35 : 0.15} />;
          })}
        {h && hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H - padB} stroke="var(--muted)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      </svg>
      {h && hover !== null && (
        <>
          <span className="absolute size-2.5 -ml-[5px] -mt-[5px] rounded-full ring-2 ring-panel pointer-events-none" style={{ left: `${(x(hover) / W) * 100}%`, top: y(h.v), background: stroke }} />
          <div
            className={`absolute z-20 rounded-lg bg-fg text-bg tabular-nums shadow-lg pointer-events-none whitespace-nowrap ${axes ? "top-1 px-2.5 py-1.5 text-[12px]" : "bottom-full mb-1.5 px-2 py-1 text-[11px]"}`}
            style={{ left: `${(x(hover) / W) * 100}%`, transform: axes ? `translateX(${x(hover) > W * 0.6 ? "-105%" : "8px"})` : `translateX(-${Math.round((x(hover) / W) * 100)}%)` }}
          >
            <div className="font-semibold">{format(h.v)}</div>
            <div className="opacity-70">{label ? label(hover) : timeLabel(h.t, tspan)}</div>
            {bars && <div className="opacity-70">{barLabel} {format(bars[hover] ?? 0)}</div>}
          </div>
        </>
      )}
      {axes &&
        ticks.map((v, i) => (
          <span key={i} className="absolute right-0 -translate-y-1/2 text-[11px] text-muted tabular-nums pointer-events-none" style={{ top: y(v) }}>
            {format(v)}
          </span>
        ))}
      {axes && data.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[11px] text-muted tabular-nums pointer-events-none" style={{ right: padR / (W / 100) + "%" }}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            // Local time: the server (UTC) and the browser format it differently, so let the client text win.
            <span key={f} suppressHydrationWarning>{timeLabel(data[Math.round(f * (data.length - 1))].t, tspan)}</span>
          ))}
        </div>
      )}
      {isEmpty && empty && <div className="absolute inset-0 grid place-items-center" style={{ bottom: padB }}>{empty}</div>}
    </div>
  );
}

/** Half-circle gauge (0–100) with a coloured track and a marker, like a sentiment index. */
export function Gauge({ value, label, size = 180 }: { value: number; label: string; size?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 80;
  const cx = 100;
  const cy = 95;
  const pt = (p: number) => {
    const a = Math.PI * (1 - p / 100);
    // Rounded: Node and browsers disagree on the last digits of cos/sin, which breaks hydration.
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)].map((n) => Math.round(n * 100) / 100);
  };
  const seg = (from: number, to: number) => {
    const [x1, y1] = pt(from);
    const [x2, y2] = pt(to);
    return `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`;
  };
  const colors = ["var(--down)", "hsl(25 90% 55%)", "var(--warn)", "hsl(90 60% 45%)", "var(--up)"];
  const [mx, my] = pt(v);
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.6 }}>
      <svg viewBox="0 0 200 120" className="size-full" aria-hidden>
        {colors.map((c, i) => (
          <path key={i} d={seg(i * 20 + 1.5, (i + 1) * 20 - 1.5)} stroke={c} strokeWidth={12} strokeLinecap="round" fill="none" />
        ))}
        <circle cx={mx} cy={my} r={9} fill="var(--panel)" stroke="var(--fg)" strokeWidth={3} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center leading-none">
        <div className="text-[30px] font-semibold tabular-nums tracking-[-0.02em]">{Math.round(v)}</div>
        <div className="mt-1 text-[12px] text-muted">{label}</div>
      </div>
    </div>
  );
}

type Series = { t: number[]; trades: number[]; volume: number[] };

/** Kadd activity card: a cumulative line with per-bucket bars, switchable between trades/volume and 24h/7d. */
export function ActivityChart({ hourly, daily, allTime }: { hourly: Series; daily: Series; allTime: { trades: number; volume: number } }) {
  const [metric, setMetric] = useState<"trades" | "volume">("trades");
  const [range, setRange] = useState<"24h" | "7d">("24h");
  const s = range === "24h" ? hourly : daily;
  const per = s[metric];
  const data = per.map((_, i) => ({ t: s.t[i], v: per.slice(0, i + 1).reduce((x, y) => x + y, 0) }));
  const run = data.length ? data[data.length - 1].v : 0;
  const fmt = metric === "volume" ? (v: number) => "$" + v.toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 2 : 0 }) : (v: number) => Math.round(v).toLocaleString("en-US");
  const seg = (on: boolean) => `h-7 px-3 rounded-md text-[12px] font-medium ${on ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Metric" className="flex p-0.5 rounded-lg bg-raised">
          {(["trades", "volume"] as const).map((m) => <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)} className={seg(metric === m)}>{m === "trades" ? "Trades" : "Volume"}</button>)}
        </div>
        <div role="tablist" aria-label="Range" className="ml-auto flex p-0.5 rounded-lg bg-raised">
          {(["24h", "7d"] as const).map((r) => <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={seg(range === r)}>{r}</button>)}
        </div>
      </div>
      <div className="flex gap-8">
        <div>
          <div className="text-[12px] text-muted">Last {range}</div>
          <div className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] leading-tight">{fmt(run)}</div>
        </div>
        <div>
          <div className="text-[12px] text-muted">All time</div>
          <div className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] leading-tight text-muted">{fmt(allTime[metric])}</div>
        </div>
      </div>
      <AreaChart
        data={data}
        bars={per}
        format={fmt}
        height={320}
        barLabel={range === "24h" ? "That hour" : "That day"}
        color="var(--brand)"
        empty={<p className="px-3 py-1.5 rounded-lg bg-panel border border-line text-[13px] text-muted">No {metric} in the last {range}. Make the first trade in Trenches.</p>}
      />
    </div>
  );
}
