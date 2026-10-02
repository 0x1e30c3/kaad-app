"use client";
import { useState } from "react";

// Token logo when the token has one; otherwise a 5x5 mirrored identicon from the address (stable, distinct).
export default function TokenIcon({ t, size = 48 }: { t: { address: string; image?: string | null }; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (t.image && !broken)
    // eslint-disable-next-line @next/next/no-img-element -- logos come from arbitrary hosts; next/image would need each one allow-listed
    return <img src={t.image} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} className="shrink-0 rounded-lg bg-raised object-cover" style={{ width: size, height: size }} />;
  const hue = parseInt(t.address.slice(2, 8), 16) % 360;
  const bits = t.address.slice(2, 17).split("").map((c) => parseInt(c, 16) % 2 === 0);
  const cells: [number, number][] = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 3; x++)
      if (bits[y * 3 + x]) {
        cells.push([x, y]);
        if (x < 2) cells.push([4 - x, y]);
      }
  const fg = `hsl(${hue} 62% 52%)`;
  return (
    <svg width={size} height={size} viewBox="0 0 7 7" className="shrink-0 rounded-lg" aria-hidden>
      <rect width="7" height="7" fill={`hsl(${hue} 45% 50% / 0.14)`} />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + 1} y={y + 1} width="1" height="1" fill={fg} />
      ))}
    </svg>
  );
}
