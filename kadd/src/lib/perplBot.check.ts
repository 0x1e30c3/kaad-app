// Self-check for the perps copy bot's reconcile step: npx tsx --conditions=react-server src/lib/perplBot.check.ts
import assert from "node:assert/strict";
import { reconcile, type BotRules } from "./perplBot";
import type { PerpPosition } from "./perpl";

const pos = (market: string, side: "long" | "short", notional: number, leverage: number) => ({ market, side, notional, leverage }) as PerpPosition;
const rules: BotRules = { budget: 100, maxLeverage: 3, minUsd: 10, band: 0.2 };

// Leader: $10k equity, BTC long $20k at 5x and ETH short $5k at 2x. Budget $100 → scale 1%.
const leader = [pos("BTC", "long", 20_000, 5), pos("ETH", "short", 5_000, 2)];
const fresh = reconcile(leader, 10_000, [], rules);
assert.deepEqual(fresh.map((i) => [i.market, i.action, i.side, Math.round(i.notional), i.leverage]), [
  ["BTC", "open", "long", 200, 3], // leverage capped at 3x
  ["ETH", "open", "short", 50, 2],
]);
// Margin never exceeds the budget: 200/3 + 50/2 = 91.7 ≤ 100.
assert.ok(fresh.reduce((s, i) => s + i.notional / i.leverage, 0) <= 100);

// Already close to target: nothing to do (inside the 20% band).
assert.equal(reconcile(leader, 10_000, [{ market: "BTC", side: "long", notional: 190 }, { market: "ETH", side: "short", notional: 48 }], rules).length, 0);

// Leader flipped BTC to short and closed ETH: close both, then open the new short.
const flipped = reconcile([pos("BTC", "short", 20_000, 5)], 10_000, [{ market: "BTC", side: "long", notional: 200 }, { market: "ETH", side: "short", notional: 50 }], rules);
assert.deepEqual(flipped.map((i) => [i.market, i.action, i.side]), [["BTC", "close", "long"], ["BTC", "open", "short"], ["ETH", "close", "short"]]);

// Leader trimmed BTC by half: close the difference.
const trimmed = reconcile([pos("BTC", "long", 10_000, 5)], 10_000, [{ market: "BTC", side: "long", notional: 200 }], rules);
assert.deepEqual(trimmed.map((i) => [i.action, Math.round(i.notional)]), [["close", 100]]);

// High leverage everywhere: total margin is scaled down to the budget.
const heavy = reconcile([pos("BTC", "long", 90_000, 10), pos("SOL", "long", 90_000, 10)], 20_000, [], { ...rules, maxLeverage: 1 });
assert.ok(Math.abs(heavy.reduce((s, i) => s + i.notional / i.leverage, 0) - 100) < 1e-9);

// No equity known: never trade.
assert.equal(reconcile(leader, 0, [], rules).length, 0);
console.log("perplBot ok");
