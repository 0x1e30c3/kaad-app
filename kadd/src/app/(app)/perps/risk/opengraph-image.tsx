import { ImageResponse } from "next/og";
import { perpRisk } from "@/lib/perpl";
import { liquidatedAt } from "@/lib/perplRisk";
import { DOWN, Frame, Stat, UP, size } from "@/lib/og";

export { size };
export const contentType = "image/png";
export const alt = "Perpl liquidation map on Kadd";
export const revalidate = 300;

const compact = (n: number) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "K" : n.toFixed(0));

/** Share card with the live numbers: what a 5% BTC move would liquidate, and the protocol's size. */
export default async function Image() {
  const r = await perpRisk().catch(() => null);
  const btc = r?.markets.find((m) => m.name === "BTC") ?? r?.markets[0];
  return new ImageResponse(
    (
      <Frame footer="Perpl · Monad mainnet">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ fontSize: 30, color: "#8a8f98" }}>Liquidation map</span>
          <span style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
            {btc ? `A 5% ${btc.name} move liquidates ${compact(liquidatedAt(btc.liqMap, -5))} of longs and ${compact(liquidatedAt(btc.liqMap, 5))} of shorts` : "Where Perpl positions get liquidated"}
          </span>
        </div>
        {r && (
          <div style={{ display: "flex", gap: 96 }}>
            <Stat label="Open interest" value={compact(r.openInterest)} />
            <Stat label="24h volume" value={compact(r.volume24h)} />
            <Stat label="Within 5% of liquidation" value={String(r.near.count)} color={r.near.count ? DOWN : UP} />
          </div>
        )}
      </Frame>
    ),
    size,
  );
}
