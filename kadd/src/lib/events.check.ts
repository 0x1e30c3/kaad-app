// Self-check for timestamp interpolation: npx tsx --conditions=react-server src/lib/events.check.ts
import assert from "node:assert/strict";
import { copyStatsFrom, interpolate } from "./events";

const anchors = [[100, 1000], [200, 1030]] as const; // 0.3 s per block
assert.equal(interpolate(anchors, 150), 1015); // between anchors
assert.equal(interpolate(anchors, 200), 1030); // on an anchor
assert.equal(interpolate(anchors, 50), 985); // before the first: same rate backwards
assert.equal(interpolate([[100, 1000]], 90), 996); // single anchor: 0.4 s per block
// copyStatsFrom: two vaults on leader A (one closed), one on B; funding adds to the deposit; copies counted per leader.
const ev = <T,>(args: T) => ({ args }) as never;
const stats = copyStatsFrom({
  followed: [ev({ id: 0n, leader: "0xA", deposit: 20_000_000n }), ev({ id: 1n, leader: "0xA", deposit: 10_000_000n }), ev({ id: 2n, leader: "0xB", deposit: 5_000_000n })],
  funded: [ev({ id: 0n, amount: 5_000_000n })],
  closed: [ev({ id: 1n })],
  copied: [ev({ id: 0n }), ev({ id: 0n }), ev({ id: 1n }), ev({ id: 2n })],
});
assert.deepEqual(stats.get("0xa"), { copiers: 1, depositedUsd: 25, copies: 3 }); // a closed vault's copies still happened
assert.deepEqual(stats.get("0xb"), { copiers: 1, depositedUsd: 5, copies: 1 });
console.log("events ok");
