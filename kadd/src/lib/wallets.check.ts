// Self-check for mainnet wallet aggregation: npx tsx --conditions=react-server src/lib/wallets.check.ts
import assert from "node:assert/strict";
import { aggregate, type WalletTrade } from "./wallets";

const token = { address: "0xt", symbol: "T", image: null, price: 1 };
const t = (trader: string, side: "buy" | "sell", usd: number, at: number): WalletTrade => ({ at, side, usd, amount: usd, price: 1, trader, tx: "0x", token });

const rows = aggregate([t("a", "buy", 100, 1000), t("a", "sell", 150, 2000), t("b", "buy", 30, 1500)], 3000);
assert.deepEqual(rows.map((r) => r.address), ["a", "b"]); // by volume
assert.equal(rows[0].volume, 250);
assert.equal(rows[0].net, 50); // sold 150 − bought 100
assert.equal(rows[0].buys, 1);
assert.equal(rows[0].sells, 1);
assert.equal(rows[0].lastAt, 2000);
assert.equal(rows[0].series[0].v, 100); // first point = window start (the oldest trade)
assert.equal(rows[0].series[7].v, 250);
assert.equal(rows[1].net, -30);
console.log("wallets ok");

// Backtest: buy $10 at $1, leader sells at $2 → +$10; buy $10 at $1, still held, now $0.5 → −$5. Total +$5 on $20.
import { backtest } from "./wallets";
const tok = (address: string, price: number) => ({ address, symbol: address, image: null, price });
const tr = (token: ReturnType<typeof tok>, side: "buy" | "sell", price: number, at: number): WalletTrade => ({ at, side, usd: 1, amount: 1, price, trader: "a", tx: "0x", token });
const A = tok("A", 3), B = tok("B", 0.5);
const bt = backtest([tr(A, "buy", 1, 1), tr(B, "buy", 1, 2), tr(A, "sell", 2, 3), tr(B, "sell", 1, 0)], 10, 10_000);
// The B sell at t=0 comes before its buy, so it's skipped (nothing to exit yet).
assert.equal(bt.pnl, 5);
assert.equal(bt.invested, 20);
assert.equal(bt.roi, 25);
assert.equal(bt.copied, 3);
assert.equal(bt.closed, 1);
assert.equal(bt.winRate, 100);
assert.equal(bt.curve.at(-1)!.v, 5);
console.log("backtest ok");
