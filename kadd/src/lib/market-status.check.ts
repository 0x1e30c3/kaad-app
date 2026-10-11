import assert from "node:assert/strict";
import { trenchesSnapshot } from "./market";

const original = globalThis.fetch;
let mode: "ok" | "empty" | "offline" | "partial" | "old" = "offline";
const pool = {
  attributes: { address: "0xpool", pool_created_at: "2026-10-01", base_token_price_usd: "1", market_cap_usd: "10000", reserve_in_usd: "60000" },
  relationships: { base_token: { data: { id: "token" } }, dex: { data: { id: "dex" } } },
};
globalThis.fetch = async (input) => {
  if (mode === "offline" || (mode === "partial" && String(input).includes("page=2"))) return new Response("unavailable", { status: 503 });
  return Response.json({ data: mode === "empty" ? [] : [pool], included: [{ id: "token", attributes: { address: "0xtoken", name: "Example", symbol: "EXAMPLE", image_url: null } }] }, {
    headers: { date: new Date(mode === "old" ? Date.now() - 180_000 : Date.now()).toUTCString() },
  });
};
async function main() {
try {
  const error = await trenchesSnapshot("new");
  assert.equal(error.error, true);
  assert.equal(error.updatedAt, null);
  mode = "ok";
  const good = await trenchesSnapshot("new");
  assert.equal(good.error, false);
  assert.equal(good.stale, false);
  assert.equal(good.tokens.length, 1);
  mode = "offline";
  const stale = await trenchesSnapshot("new");
  assert.equal(stale.stale, true);
  assert.equal(stale.error, false);
  assert.equal(stale.updatedAt, good.updatedAt);
  assert.deepEqual(stale.tokens, good.tokens);
  mode = "empty";
  const empty = await trenchesSnapshot("new");
  assert.equal(empty.error, false);
  assert.equal(empty.stale, false);
  assert.deepEqual(empty.tokens, []);
  mode = "ok";
  assert.equal((await trenchesSnapshot("hot")).tokens.length, 1, "Deduplicate pages");
  mode = "partial";
  assert.equal((await trenchesSnapshot("hot")).stale, true, "Mark mixed fresh/fallback pages stale");
  assert.equal((await trenchesSnapshot("top")).error, true, "Do not present incomplete uncached pages as an empty success");
  mode = "ok";
  assert.equal((await trenchesSnapshot("hot")).stale, false, "Recovery clears stale status");
  mode = "old";
  assert.equal((await trenchesSnapshot("new")).stale, true, "Old HTTP cache timestamps remain stale");
  console.log("market status ok: error, populated, fallback, empty, partial, recovery, old cache");
} finally { globalThis.fetch = original; }

}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
