// Perps risk maths, pure (no network): where open positions get liquidated, and how a wallet has traded.

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

export type CloseRow = { pnlUsd: number; timestamp: number; symbol: string; holdSec: number; kind: string };
export type WalletPerf = {
  trades: number; // full closes, flips and liquidations
  wins: number;
  losses: number;
  winRate: number | null;
  profitFactor: number | null; // gross profit / gross loss
  realized: number;
  maxDrawdown: number; // largest peak-to-trough fall of cumulative realized PnL, USD
  bestStreak: number; // most wins in a row
  worstStreak: number; // most losses in a row
  avgHoldSec: number | null;
  best: { symbol: string; pnl: number } | null;
  worst: { symbol: string; pnl: number } | null;
  curve: { t: number; v: number }[]; // cumulative realized PnL
};

/** Performance from a wallet's realized events (any order). Partial closes count toward PnL, not toward win/loss. */
export function walletPerf(rows: CloseRow[]): WalletPerf {
  const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);
  let cum = 0, peak = 0, maxDrawdown = 0, gain = 0, loss = 0, wins = 0, losses = 0, streak = 0, bestStreak = 0, worstStreak = 0, hold = 0, holds = 0;
  const bySymbol = new Map<string, number>();
  const curve: { t: number; v: number }[] = [];
  for (const r of sorted) {
    cum += r.pnlUsd;
    peak = Math.max(peak, cum);
    maxDrawdown = Math.max(maxDrawdown, peak - cum);
    curve.push({ t: r.timestamp, v: cum });
    bySymbol.set(r.symbol, (bySymbol.get(r.symbol) ?? 0) + r.pnlUsd);
    if (r.pnlUsd > 0) gain += r.pnlUsd;
    else loss -= r.pnlUsd;
    if (r.kind === "partial") continue;
    if (r.holdSec > 0) {
      hold += r.holdSec;
      holds++;
    }
    if (r.pnlUsd > 0) {
      wins++;
      streak = streak > 0 ? streak + 1 : 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      losses++;
      streak = streak < 0 ? streak - 1 : -1;
      worstStreak = Math.max(worstStreak, -streak);
    }
  }
  const markets = [...bySymbol].sort((a, b) => b[1] - a[1]);
  return {
    trades: wins + losses,
    wins,
    losses,
    winRate: wins + losses ? (wins / (wins + losses)) * 100 : null,
    profitFactor: loss > 0 ? gain / loss : gain > 0 ? Infinity : null,
    realized: cum,
    maxDrawdown,
    bestStreak,
    worstStreak,
    avgHoldSec: holds ? hold / holds : null,
    best: markets.length ? { symbol: markets[0][0], pnl: markets[0][1] } : null,
    worst: markets.length ? { symbol: markets.at(-1)![0], pnl: markets.at(-1)![1] } : null,
    curve,
  };
}

/** How close a position is to liquidation: share of the price that is left before it, 0 = at liquidation. */
export const liqDistance = (side: "long" | "short", mark: number, liquidation: number) =>
  mark > 0 && liquidation > 0 ? (side === "long" ? (mark - liquidation) / mark : (liquidation - mark) / mark) : Infinity;
