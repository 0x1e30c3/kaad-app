// Self-check for leaderboard scoring: npx tsx --conditions=react-server src/lib/leaderboard.check.ts
import assert from "node:assert/strict";
import { score, type Trade } from "./leaderboard";

const t = (isBuy: boolean, quote: number, base: number, ago: number): Trade => ({ who: "a", pool: "p", isBuy, quote, base, ago });
const price = new Map([["p", 2]]);

// Buy 10 tokens for $10, sell 5 for $10 (a win), hold 5 worth $2 each now: pnl = -10 + 10 + 10 = 10.
const s = score([t(true, 10, 10, 3600), t(false, 10, 5, 60)], price, 1);
assert.equal(s.pnl, 10);
assert.equal(s.roi, 100);
assert.equal(s.win, 100);
assert.equal(s.volume, 20);
assert.equal(s.trades, 2);
assert.equal(s.series[0], 0);
assert.equal(s.series[7], 10);

// Trades older than the window are ignored; no sells means no win rate.
const old = score([t(true, 10, 10, 2 * 86400)], price, 1);
assert.equal(old.trades, 0);
assert.equal(old.win, null);

// Selling below average cost is a loss.
const loss = score([t(true, 10, 10, 3600), t(false, 4, 10, 60)], new Map([["p", 0]]), 1);
assert.equal(loss.pnl, -6);
assert.equal(loss.win, 0);
console.log("leaderboard ok");
