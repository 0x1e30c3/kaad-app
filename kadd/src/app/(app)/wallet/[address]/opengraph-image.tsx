import { ImageResponse } from "next/og";
import { isAddress } from "viem";
import { walletCard } from "@/lib/share";
import { Blockie, DOWN, Frame, Stat, UP, pct, signed, size } from "@/lib/og";
import { short } from "@/lib/mock";

export { size };
export const contentType = "image/png";
export const alt = "Wallet on Kadd";
export const revalidate = 600;

export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const a = isAddress(address, { strict: false }) ? address.toLowerCase() : "0x0000000000000000000000000000000000000000";
  const w = await walletCard(a);
  const [label, value, good] = w.smart
    ? ["Nansen 30-day PnL", signed(w.smart.pnl30d, 0), w.smart.pnl30d >= 0]
    : ["Copy backtest ROI", pct(w.backtest.roi), w.backtest.roi >= 0];
  return new ImageResponse(
    (
      <Frame footer="kaad-app.vercel.app">
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Blockie address={a} px={128} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 60, fontWeight: 700 }}>{w.name ?? short(a)}</span>
            <span style={{ fontSize: 28, color: "#8a8f98" }}>{w.smart ? (w.smart.label ?? "Nansen smart money") : "Monad mainnet wallet"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 96 }}>
          <Stat label={label} value={value} color={good ? UP : DOWN} />
          {w.smart ? <Stat label="Win rate" value={`${w.smart.winRate.toFixed(0)}%`} /> : <Stat label="Trades copied in backtest" value={String(w.backtest.copied)} />}
          {w.copiers > 0 && <Stat label="Copying on Kadd" value={String(w.copiers)} />}
        </div>
      </Frame>
    ),
    size,
  );
}
