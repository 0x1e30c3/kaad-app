// Self-check for the risk engine: npm run check:risk
import assert from "node:assert/strict";
import { analyzeRisk, badgeOf, type RiskInput } from "../src/lib/risk";

const now = Date.UTC(2026, 9, 2);
const healthy: RiskInput = {
  symbol: "CHOG", liq: 165_000, mc: 2_900_000, createdAt: now - 300 * 864e5, change: { h1: 2, h24: -5 }, vol: { h24: 150_000 },
  txns: { h1: { buys: 20, sells: 15 } }, holders: 33_000, score: 78, honeypot: false, verified: true, trades: null,
};
const a = analyzeRisk(healthy, now);
assert.equal(a.level, "low");
assert.equal(badgeOf(a.level), "safe");
assert.ok(a.factors.some((f) => f.severity === "good"));

const rug = analyzeRisk({ ...healthy, symbol: "RUG", liq: 1_200, mc: 30_000, createdAt: now - 20 * 6e4, holders: 40, score: 20, verified: false }, now);
assert.equal(rug.level, "critical");
assert.equal(rug.factors[0].severity, "high");
assert.match(rug.summary, /^RUG is very dangerous/);

const honeypot = analyzeRisk({ ...healthy, honeypot: true }, now);
assert.equal(honeypot.level, "critical");
assert.equal(honeypot.factors[0].id, "honeypot");

const whale = analyzeRisk({ ...healthy, trades: [...Array(9)].map((_, i) => ({ usd: 10, trader: "0x" + i })).concat({ usd: 500, trader: "0xwhale" }) }, now);
assert.ok(whale.factors.some((f) => f.id === "whale"));

const unknown = analyzeRisk({ ...healthy, holders: null, score: null, honeypot: null, verified: null }, now);
assert.ok(!unknown.factors.some((f) => ["holders", "score", "honeypot", "unverified"].includes(f.id)), "missing data is never counted against a token");
console.log("risk engine ok");

// Candles: duplicate timestamps from the provider are merged and the result is strictly ascending.
const { toCandles } = await import("../src/lib/market");
const cs = toCandles([[300, 1, 2, 1, 2, 5], [200, 1, 1, 1, 1, 1], [300, 2, 4, 1, 3, 5]], 10);
assert.deepEqual(cs.map((c) => c.time), [200, 300]);
assert.deepEqual(cs[1], { time: 300, open: 10, high: 40, low: 10, close: 30, value: 10 });
console.log("candles ok");
