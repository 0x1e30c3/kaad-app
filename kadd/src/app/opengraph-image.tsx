import { ImageResponse } from "next/og";
import { Frame, size } from "@/lib/og";

export { size };
export const contentType = "image/png";
export const alt = "Kadd: follow Monad's smart money safely";

/** The default share card for every page without its own (landing, /start, /perps, …). */
export default function Image() {
  return new ImageResponse(
    (
      <Frame footer="kaad-app.vercel.app">
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <span style={{ display: "flex", alignSelf: "flex-start", padding: "8px 18px", borderRadius: 999, background: "#c8f25a", color: "#0a0a0a", fontSize: 26, fontWeight: 700 }}>Live on Monad</span>
          <span style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Follow Monad&apos;s smart money, safely.</span>
          <span style={{ fontSize: 34, color: "#8a8f98", lineHeight: 1.35 }}>See who&apos;s winning, check their risk, copy them with limits a contract enforces. Spot or perps, one passkey.</span>
        </div>
      </Frame>
    ),
    size,
  );
}
