// Writes seeds.json: popular Monad memecoins with their live mainnet price (DexScreener), for SeedMirrors.s.sol.
//   node seed-mirrors.mjs && forge script script/SeedMirrors.s.sol --rpc-url monad_testnet --broadcast --account kadd-deployer
import { writeFileSync } from "node:fs";
const TOKENS = [
  "0x350035555e10d9afaf1566aaebfced5ba6c27777", // CHOG
  "0x7b2728c04ad436153285702e969e6efac3a97777", // MOLANDAK
  "0x81a224f8a62f52bde942dbf23a56df77a10b7777", // emo
  "0xa9da3c77ec7cdc4dfaa1fe142af583543d1c540f", // FLING
  "0x3ec7310937281ca4bf89d5bb11704be9b7ff7777", // ANAGO
  "0x0a332311633c0625f63cfc51ee33fc49826e0a3c", // APR
];
const pairs = await (await fetch(`https://api.dexscreener.com/tokens/v1/monad/${TOKENS.join(",")}`)).json();
const seeds = TOKENS.flatMap((addr) => {
  const best = pairs
    .filter((p) => p.baseToken.address.toLowerCase() === addr)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  if (!best?.priceUsd) return console.error(`skip ${addr}: no price`), [];
  // Same formula as the app (venue.ts openMirror): 50,000 tUSDC against 50,000 / price tokens.
  const seed = BigInt(Math.round((50_000 / Number(best.priceUsd)) * 1e6)) * 10n ** 12n;
  console.log(`${best.baseToken.symbol.padEnd(9)} $${best.priceUsd}`);
  return [{ source: addr, name: best.baseToken.name, symbol: best.baseToken.symbol, seed: seed.toString() }];
});
// One array per field: forge reads typed arrays reliably (seeds stay decimal strings, they overflow JSON numbers).
const col = (k) => seeds.map((x) => x[k]);
writeFileSync(new URL("./seeds.json", import.meta.url), JSON.stringify({ sources: col("source"), names: col("name"), symbols: col("symbol"), seeds: col("seed") }, null, 2));
