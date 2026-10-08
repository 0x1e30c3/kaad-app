// Self-check for Telegram dispatch bookkeeping: npx tsx --conditions=react-server src/lib/telegram.check.ts
import assert from "node:assert/strict";
import { fresh, lines } from "./telegram";

const items = [{ tx: "c" }, { tx: "b" }, { tx: "a" }];
assert.deepEqual(fresh(items, null), { send: [], seen: ["c", "b", "a"] }); // first pass only records
assert.deepEqual(fresh(items, ["a"]).send, [{ tx: "c" }, { tx: "b" }]);
assert.equal(fresh(items, ["a", "b", "c"]).send.length, 0);
assert.deepEqual(lines(["1", "2"]), ["1", "2"]);
assert.equal(lines(["1", "2", "3", "4"]).length, 1); // a backlog is one summary message
console.log("telegram ok");
