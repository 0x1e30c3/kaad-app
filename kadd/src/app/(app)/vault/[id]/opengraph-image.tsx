import { ImageResponse } from "next/og";
import { vaultView } from "@/lib/share";
import { Blockie, DOWN, Frame, Stat, UP, pct, size } from "@/lib/og";
import { short } from "@/lib/mock";

export { size };
export const contentType = "image/png";
export const alt = "Kadd copy vault";
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const v = await vaultView(Number((await params).id));
  return new ImageResponse(
    v ? (
      <Frame footer={`Copy vault #${v.id} · Monad testnet`}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Blockie address={v.leader} px={128} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 28, color: "#8a8f98" }}>{v.active ? "Auto-copying" : "Copied"}</span>
            <span style={{ fontSize: 60, fontWeight: 700 }}>{v.leaderName ?? short(v.leader)}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 96 }}>
          <Stat label="Return" value={pct(v.pnlPct)} color={v.pnlPct >= 0 ? UP : DOWN} />
          <Stat label="Trades copied" value={String(v.copies.length)} />
          <Stat label="Limits" value={`$${v.perTradeUsd} / $${v.dailyCapUsd}`} />
        </div>
      </Frame>
    ) : (
      <Frame footer="Monad testnet">
        <span style={{ fontSize: 60, fontWeight: 700 }}>Copy vault not found</span>
      </Frame>
    ),
    size,
  );
}
