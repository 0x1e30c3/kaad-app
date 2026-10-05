// Self-check for chart gap filling: npx tsx src/lib/market.check.ts
import assert from "node:assert/strict";
import { fillGaps } from "./market";

const c = (time: number, close: number) => ({ time, open: close, high: close, low: close, close, value: 1 });
const out = fillGaps([c(0, 1), c(180, 2)], 60, 300);
assert.deepEqual(out.map((x) => x.time), [0, 60, 120, 180, 240, 300]);
assert.deepEqual(out.map((x) => x.close), [1, 1, 1, 2, 2, 2]); // flat at the previous close
assert.equal(out[1].value, 0);
assert.equal(out[1].open, 1);
assert.equal(fillGaps([c(0, 1)], 60, 600, 3).length, 3); // keeps the newest `max`
assert.deepEqual(fillGaps([], 60, 600), []);
console.log("market ok");
