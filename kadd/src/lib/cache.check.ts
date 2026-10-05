// Self-check for swr(): npx tsx --conditions=react-server src/lib/cache.check.ts
import assert from "node:assert/strict";
import { swr } from "./cache";

async function main() {
  let calls = 0;
  const slow = (v: number) => () => new Promise<number>((r) => setTimeout(() => r((calls++, v)), 20));

  // Concurrent first calls share one fetch.
  const [a, b] = await Promise.all([swr("k", 50, slow(1)), swr("k", 50, slow(2))]);
  assert.deepEqual([a, b, calls], [1, 1, 1]);
  // Fresh: cached, no fetch.
  assert.equal(await swr("k", 50, slow(3)), 1);
  assert.equal(calls, 1);
  // Stale: old value at once, refresh in the background.
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(await swr("k", 50, slow(4)), 1);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(await swr("k", 50, slow(5)), 4);
  // A failed refresh keeps the last good value.
  await new Promise((r) => setTimeout(r, 60));
  const orig = console.error;
  console.error = () => {};
  assert.equal(await swr("k", 50, () => Promise.reject(new Error("down"))), 4);
  await new Promise((r) => setTimeout(r, 10));
  console.error = orig;
  assert.equal(await swr("k", 50, slow(6)), 4); // stale still served; this call starts a new refresh
  // First call with no value propagates the error.
  await assert.rejects(swr("fresh", 50, () => Promise.reject(new Error("x"))));
  console.log("cache ok");
}
main();
