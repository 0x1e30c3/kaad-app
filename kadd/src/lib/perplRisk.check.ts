// Self-check for perps risk maths: npx tsx src/lib/perplRisk.check.ts
import assert from "node:assert/strict";
import { liqDistance, liquidatedAt, liquidationMap, walletPerf } from "./perplRisk";

// Mark 100. Longs liquidate at 95 ($1k) and 89.5 ($2k); a short at 104 ($500); one far away (long at 40) is out of range.
const map = liquidationMap(
  [
    { side: "long", notional: 1000, liquidation: 95 },
    { side: "long", notional: 2000, liquidation: 89.5 },
    { side: "short", notional: 500, liquidation: 104 },
    { side: "long", notional: 9999, liquidation: 40 },
    { side: "long", notional: 300, liquidation: 101 }, // underwater on a stale mark: first bucket below
  ],
  100,
);
const at = (move: number) => map.find((b) => b.move === move)!;
assert.equal(at(-5).longUsd, 1000);
assert.equal(at(-11).longUsd, 2000);
assert.equal(at(4).shortUsd, 500);
assert.equal(at(-1).longUsd, 300);
assert.equal(map.reduce((s, b) => s + b.longUsd, 0), 3300); // the 40 one is past −30%
assert.equal(liquidatedAt(map, -5), 1300);
assert.equal(liquidatedAt(map, -15), 3300);
assert.equal(liquidatedAt(map, 3), 0);
assert.equal(liquidatedAt(map, 5), 500);

// Wallet: +10, −4 (partial, PnL only), +6, −20 (liquidation), +3 → realized −5; drawdown from peak 12 to −8 = 20.
const perf = walletPerf([
  { pnlUsd: 10, timestamp: 1, symbol: "BTC", holdSec: 600, kind: "close" },
  { pnlUsd: -4, timestamp: 2, symbol: "BTC", holdSec: 0, kind: "partial" },
  { pnlUsd: 6, timestamp: 3, symbol: "ETH", holdSec: 1200, kind: "close" },
  { pnlUsd: -20, timestamp: 4, symbol: "SOL", holdSec: 300, kind: "liquidation" },
  { pnlUsd: 3, timestamp: 5, symbol: "BTC", holdSec: 0, kind: "close" },
]);
assert.equal(perf.realized, -5);
assert.equal(perf.trades, 4);
assert.equal(perf.wins, 3);
assert.equal(perf.winRate, 75);
assert.equal(perf.maxDrawdown, 20);
assert.equal(perf.bestStreak, 2);
assert.equal(perf.worstStreak, 1);
assert.equal(Math.round(perf.profitFactor! * 100) / 100, 0.79); // 19 / 24
assert.equal(perf.avgHoldSec, 700); // closes with a known open time only
assert.deepEqual(perf.best, { symbol: "BTC", pnl: 9 });
assert.deepEqual(perf.worst, { symbol: "SOL", pnl: -20 });
assert.equal(walletPerf([]).winRate, null);

assert.equal(liqDistance("long", 100, 95), 0.05);
assert.equal(liqDistance("short", 100, 110), 0.1);
console.log("perplRisk ok");
