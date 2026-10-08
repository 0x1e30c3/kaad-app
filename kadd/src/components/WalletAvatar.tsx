"use client";
import { useState } from "react";
import { blockie } from "@/lib/blockie";

/** A wallet's avatar: its NNS avatar when it has one that loads, else its blockie. */
export default function WalletAvatar({ address, src, size = 28 }: { address: string; src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken)
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-set URLs; next/image would need every host allow-listed
    return <img src={src} alt="" width={size} height={size} onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover bg-raised" style={{ width: size, height: size }} />;
  const b = blockie(address);
  return (
    <svg viewBox="0 0 8 8" width={size} height={size} className="shrink-0 rounded-full" aria-hidden shapeRendering="crispEdges">
      <rect width="8" height="8" fill={b.bg} />
      {b.cells.map((c, i) => (c ? <rect key={i} x={i % 8} y={Math.floor(i / 8)} width="1" height="1" fill={c === 1 ? b.fg : b.spot} /> : null))}
    </svg>
  );
}
