// Self-check for the copy keeper's planning: npx tsx --conditions=react-server src/lib/keeper.check.ts
import assert from "node:assert/strict";
import { copyKey, plan, riskBlock } from "./keeper";
import type { WalletTrade } from "./wallets";

const token = { address: "0x00000000000000000000000000000000000000aa", symbol: "T", image: null, price: 1 };
const t = (trader: string, side: "buy" | "sell", at: number, tx: string): WalletTrade => ({ at, side, usd: 1, amount: 1, price: 1, trader, tx, token });
const trades = [t("lead", "sell", 3000, "0x03"), t("lead", "buy", 1000, "0x01"), t("lead", "buy", 2000, "0x02"), t("other", "buy", 2500, "0x09")];

// Follow started at t=1.5s: only later trades, oldest first; sells only when opted in.
const withSells = plan([{ kind: "copy", id: 0n, leader: "lead", since: 1.5, copySells: true }], trades);
assert.deepEqual(withSells.map((p) => [p.tx, p.isBuy]), [["0x02", true], ["0x03", false]]);
const buysOnly = plan([{ kind: "club", id: 1n, leader: "lead", since: 0, copySells: false }], trades);
assert.deepEqual(buysOnly.map((p) => [p.tx, p.kind]), [["0x01", "club"], ["0x02", "club"]]);

// Matches Solidity keccak256(abi.encode(bytes32, address)): 32-byte word each, address left-padded.
const k = copyKey(`0x${"11".repeat(32)}`, token.address as `0x${string}`);
assert.match(k, /^0x[0-9a-f]{64}$/);
assert.notEqual(k, copyKey(`0x${"11".repeat(32)}`, "0x00000000000000000000000000000000000000bb"));
// Risk guard: only a critical analysis blocks a copied buy; missing data never does.
const analysis = (level: "low" | "critical") => ({ score: level === "critical" ? 80 : 5, level, factors: [{ id: "honeypot", severity: "critical" as const, points: 70, title: "Looks like a honeypot", detail: "" }], summary: "", advice: [] });
assert.match(riskBlock(analysis("critical"))!, /honeypot.*score 80/);
assert.equal(riskBlock(analysis("low")), null);
assert.equal(riskBlock(null), null);
console.log("keeper ok");
