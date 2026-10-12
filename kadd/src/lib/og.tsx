// Building blocks for the 1200×630 share images (Satori: flexbox only, inline styles).
import { blockie } from "./blockie";
import { ogMark } from "./og-mark";

export const size = { width: 1200, height: 630 };
export const UP = "#22c55e";
export const DOWN = "#ef4444";
const signed = (n: number, d = 2) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: d })}`;
export const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
export { signed };

export function Blockie({ address, px }: { address: string; px: number }) {
  const { fg, bg, spot, cells } = blockie(address);
  const cell = px / 8;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: px, height: px, borderRadius: px / 5, overflow: "hidden", background: bg }}>
      {cells.map((c, i) => (
        <div key={i} style={{ width: cell, height: cell, background: c === 0 ? bg : c === 1 ? fg : spot }} />
      ))}
    </div>
  );
}

export function Frame({ children, footer }: { children: React.ReactNode; footer: string }) {
  return (
    <div style={{ ...size, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "#0a0b0d", color: "#f5f6f8", fontSize: 32 }}>
      {children}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, color: "#8a8f98" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 14, color: "#f5f6f8", fontWeight: 700 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL; next/image can't be used inside Satori */}
          <img alt="" width={40} height={40} src={ogMark} />
          Kadd · social trading on Monad
        </span>
        <span>{footer}</span>
      </div>
    </div>
  );
}

export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 24, color: "#8a8f98" }}>{label}</span>
      <span style={{ fontSize: 56, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
