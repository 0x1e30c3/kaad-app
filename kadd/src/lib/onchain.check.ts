// Self-check for on-chain candles: npx tsx --conditions=react-server src/lib/onchain.check.ts
import assert from "node:assert/strict";
import { encodeAbiParameters } from "viem";
import { bucket, decodeSwap } from "./onchain";

// V3: sqrtPriceX96 = 2^96 * sqrt(0.25) → 0.25 token1 per token0 (same decimals).
const V3 = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
const data = encodeAbiParameters(
  [{ type: "int256" }, { type: "int256" }, { type: "uint160" }, { type: "uint128" }, { type: "int24" }],
  [-4n * 10n ** 18n, 1n * 10n ** 18n, 2n ** 95n, 0n, 0],
);
const meta = { token0: "a", token1: "b", dec0: 18, dec1: 18 };
const as0 = decodeSwap(V3, data, meta, true)!;
assert.equal(as0.price, 0.25); // token0 priced in token1
assert.equal(as0.quoteAmount, 1);
const as1 = decodeSwap(V3, data, meta, false)!;
assert.equal(as1.price, 4); // token1 priced in token0
assert.equal(as1.quoteAmount, 4);
// Decimals: token0 18, token1 6 (e.g. a token vs USDC) → raw ratio scaled by 1e12.
assert.ok(Math.abs(decodeSwap(V3, data, { ...meta, dec1: 6 }, true)!.price - 0.25e12) < 1);

// Bucketing: two swaps in the first minute, one in the third; USD at 2x.
const c = bucket([{ t: 5, price: 1, quoteAmount: 1 }, { t: 30, price: 3, quoteAmount: 1 }, { t: 130, price: 2, quoteAmount: 2 }], 60, () => 2);
assert.deepEqual(c.map((x) => x.time), [0, 120]);
assert.deepEqual([c[0].open, c[0].high, c[0].low, c[0].close, c[0].value], [2, 6, 2, 6, 4]);
assert.equal(c[1].open, 6); // opens at the previous close
assert.equal(c[1].close, 4);
console.log("onchain ok");
