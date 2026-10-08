// Self-check for timestamp interpolation: npx tsx --conditions=react-server src/lib/events.check.ts
import assert from "node:assert/strict";
import { interpolate } from "./events";

const anchors = [[100, 1000], [200, 1030]] as const; // 0.3 s per block
assert.equal(interpolate(anchors, 150), 1015); // between anchors
assert.equal(interpolate(anchors, 200), 1030); // on an anchor
assert.equal(interpolate(anchors, 50), 985); // before the first: same rate backwards
assert.equal(interpolate([[100, 1000]], 90), 996); // single anchor: 0.4 s per block
console.log("events ok");
