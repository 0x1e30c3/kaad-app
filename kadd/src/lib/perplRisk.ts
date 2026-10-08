// Perps risk maths, pure (no network): where open positions get liquidated, and how close each one is.

export type LiqInput = { side: "long" | "short"; notional: number; liquidation: number };
/** Notional liquidated if the price moved to `move`% from the mark: longs below (move < 0), shorts above. */
export type LiqBucket = { move: number; longUsd: number; shortUsd: number };

/**
 * Open positions grouped by how far the price must move (whole %, ±`range`) to liquidate them. A position whose
 * liquidation price is past the mark already (underwater on a stale mark) lands in the first bucket on its side.
 */
export function liquidationMap(positions: LiqInput[], mark: number, range = 30): LiqBucket[] {
  const buckets = Array.from({ length: range * 2 + 1 }, (_, i) => ({ move: i - range, longUsd: 0, shortUsd: 0 }));
  if (!(mark > 0)) return buckets;
  for (const p of positions) {
    if (!(p.liquidation > 0) || !(p.notional > 0)) continue;
    const pct = ((p.liquidation - mark) / mark) * 100;
    if (p.side === "long") {
      const move = Math.min(-1, Math.floor(pct)); // a drop of at least this much
      if (move >= -range) buckets[move + range].longUsd += p.notional;
    } else {
      const move = Math.max(1, Math.ceil(pct));
      if (move <= range) buckets[move + range].shortUsd += p.notional;
    }
  }
  return buckets;
}

/** Cumulative liquidations for a move of `pct`% (negative: drop, liquidates longs; positive: rise, shorts). */
export function liquidatedAt(map: LiqBucket[], pct: number): number {
  return pct < 0 ? map.filter((b) => b.move < 0 && b.move >= pct).reduce((s, b) => s + b.longUsd, 0) : map.filter((b) => b.move > 0 && b.move <= pct).reduce((s, b) => s + b.shortUsd, 0);
}

/** How close a position is to liquidation: share of the price that is left before it, 0 = at liquidation. */
export const liqDistance = (side: "long" | "short", mark: number, liquidation: number) =>
  mark > 0 && liquidation > 0 ? (side === "long" ? (mark - liquidation) / mark : (liquidation - mark) / mark) : Infinity;
