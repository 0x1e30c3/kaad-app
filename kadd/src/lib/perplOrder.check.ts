// Self-check for Perpl order maths: npx tsx src/lib/perplOrder.check.ts
import assert from "node:assert/strict";
import { boundPrice, liquidationPrice, lotFor, marketOrder, ORDER, type PerpTerms } from "./perplOrder";

// BTC on testnet: price 1 decimal, size 5 decimals. $100 at $82,933.5 → 0.00120578 BTC → 120 lots (rounded down).
const btc: PerpTerms = { id: 16, name: "BTC", priceDecimals: 1, sizeDecimals: 5, maxLeverage: 15, maintLeverage: 25, ttlBlocks: 20, takerFee: 345 };
assert.equal(lotFor(100, 829335n, btc), 120n);
assert.equal(lotFor(0, 829335n, btc), 0n);
assert.equal(lotFor(100, 0n, btc), 0n);
// MON: price 6 decimals, size 0 decimals. $50 at $0.02619 → 1909 MON.
assert.equal(lotFor(50, 26190n, { priceDecimals: 6, sizeDecimals: 0 }), 1909n);
// Big notional stays exact: $250,000 of BTC at $83,000.0 → 3.01204819 → 301204 lots.
assert.equal(lotFor(250_000, 830000n, btc), 301204n);

// Bounds: 1% above the mark when buying (rounded up), 1% below when selling (rounded down).
assert.equal(boundPrice(829335n, true), 837629n);
assert.equal(boundPrice(829335n, false), 821041n);

// Order types and price direction: open long buys, close long sells, open short sells, close short buys.
const o = (action: "open" | "close", side: "long" | "short") => marketOrder({ terms: btc, action, side, lot: 120n, markPNS: 829335n, leverage: 2, head: 1000n, id: 1n });
assert.equal(o("open", "long").orderType, ORDER.openLong);
assert.equal(o("open", "short").orderType, ORDER.openShort);
assert.equal(o("close", "long").orderType, ORDER.closeLong);
assert.equal(o("close", "short").orderType, ORDER.closeShort);
assert.ok(o("open", "long").pricePNS > 829335n && o("close", "short").pricePNS > 829335n);
assert.ok(o("open", "short").pricePNS < 829335n && o("close", "long").pricePNS < 829335n);
assert.equal(o("open", "long").leverageHdths, 200n);
assert.equal(o("open", "long").lastExecutionBlock, 1020n);
assert.equal(o("open", "long").immediateOrCancel, true);

// Liquidation: 2x long with liquidation at 25x maintenance → price can fall 1/2 − 1/25 = 46%.
assert.equal(Math.round(liquidationPrice("long", 100, 2, 25) * 100) / 100, 54);
assert.equal(Math.round(liquidationPrice("short", 100, 10, 25) * 100) / 100, 106);
console.log("perplOrder ok");
