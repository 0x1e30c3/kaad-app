"use client";
import { useState } from "react";

/**
 * Blockie identicon: the same algorithm as ethereum-blockies (what MetaMask and Etherscan show), so a wallet looks
 * the same here as in the user's wallet and on the explorer. Seeded by the lowercase address.
 */
export function blockie(address: string, size = 8) {
  const seed = [0, 0, 0, 0];
  const s = address.toLowerCase();
  for (let i = 0; i < s.length; i++) seed[i % 4] = ((seed[i % 4] << 5) - seed[i % 4] + s.charCodeAt(i)) | 0;
  const rand = () => {
    const t = seed[0] ^ (seed[0] << 11);
    seed[0] = seed[1];
    seed[1] = seed[2];
    seed[2] = seed[3];
    seed[3] = seed[3] ^ (seed[3] >> 19) ^ t ^ (t >> 8);
    return (seed[3] >>> 0) / ((1 << 31) >>> 0);
  };
  const color = () => {
    const h = Math.floor(rand() * 360);
    const sat = rand() * 60 + 40;
    const l = (rand() + rand() + rand() + rand()) * 25;
    return `hsl(${h} ${sat}% ${l}%)`;
  };
  const fg = color();
  const bg = color();
  const spot = color();
  const half = Math.ceil(size / 2);
  const cells: number[] = [];
  for (let y = 0; y < size; y++) {
    const row = Array.from({ length: half }, () => Math.floor(rand() * 2.3));
    cells.push(...row, ...row.slice(0, size - half).reverse());
  }
  return { fg, bg, spot, cells };
}

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
