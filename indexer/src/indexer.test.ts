import { describe, it } from "vitest";
import { createTestIndexer } from "envio";

// Real Monad testnet history: the six mirror pools opening, a copy vault being created, and that vault's first live
// copy of a mainnet wallet's trade. Without HyperSync access, run through an RPC:
//   ENVIO_CONFIG=config.rpc.yaml ENVIO_RPC_URL=https://testnet-rpc.monad.xyz pnpm test
const OWNER = "0x4ff54485854be63824efbbba9eeb3eb0396cd17b"; // the vault owner
const KADD_COPY = "0x27bb7d06af7ba8ea359cfe00a628145ed0bf1661";

const sets = (r: { readonly changes: readonly object[] }, entity: string) =>
  r.changes.flatMap((c) => ((c as Record<string, { sets?: Record<string, unknown>[] } | undefined>)[entity]?.sets ?? []));

describe("Kadd indexer", () => {
  it("indexes pools and a copy vault, and credits the copy trade to the vault owner", async (t) => {
    const indexer = createTestIndexer();

    const pools = await indexer.process({ chains: { 10143: { startBlock: 67_495_087, endBlock: 67_495_112 } } });
    t.expect(sets(pools, "Pool").map((p) => p.symbol)).toEqual(["CHOG", "MOLANDAK", "emo", "FLING", "ANAGO", "APR"]);

    const vault = await indexer.process({ chains: { 10143: { startBlock: 68_297_251, endBlock: 68_297_251 } } });
    const [v] = sets(vault, "CopyVault");
    t.expect(v).toMatchObject({ id: "1", owner: OWNER, leader: "0xf70da97812cb96acdf810712aa562db8dfa3dbef", perTradeUsd: 5, dailyCapUsd: 20, depositedUsd: 20, active: true });

    const copy = await indexer.process({ chains: { 10143: { startBlock: 68_319_155, endBlock: 68_319_155 } } });
    // KaddCopy made the swap; the Copied event in the same transaction re-attributes it to the vault owner.
    const [swap] = sets(copy, "Swap");
    t.expect(swap).toMatchObject({ trader: OWNER, kind: "copy", isBuy: true, usd: 5 });
    t.expect(sets(copy, "Trader").map((x) => x.id)).not.toContain(KADD_COPY); // the contract never shows up as a trader
    t.expect(sets(copy, "Trader").at(-1)).toMatchObject({ id: OWNER, trades: 1, buys: 1, volumeUsd: 5, viaCopy: 1 });
    t.expect(sets(copy, "CopyTrade")[0]).toMatchObject({ vault: "1", isBuy: true, usd: 5 });
    t.expect(sets(copy, "CopyVault").at(-1)).toMatchObject({ id: "1", copies: 1 });
    t.expect(sets(copy, "DailyStat").at(-1)).toMatchObject({ trades: 1, volumeUsd: 5, copies: 1, newTraders: 1 });
  });

  it("indexes Perpl markets, accounts, deposits and liquidations (Monad mainnet)", async (t) => {
    const indexer = createTestIndexer();
    // Perpl's first markets, with the decimals that value liquidations in USD.
    const added = await indexer.process({ chains: { 143: { startBlock: 54_773_025, endBlock: 54_773_029 } } });
    t.expect(sets(added, "PerplMarket").map((m) => m.id)).toEqual(["1", "10"]);

    // Perpl's very first account.
    const created = await indexer.process({ chains: { 143: { startBlock: 54_972_991, endBlock: 54_972_991 } } });
    t.expect(sets(created, "PerplAccount")[0]).toMatchObject({ id: "1" });
    t.expect(sets(created, "PerplAccount")[0]!.address).toMatch(/^0x[0-9a-f]{40}$/);

    // A protocol transfer (an allocation, not trading profit): $49,900 into account 5356.
    const transfer = await indexer.process({ chains: { 143: { startBlock: 109_930_343, endBlock: 109_930_343 } } });
    t.expect(sets(transfer, "PerplAccount").find((a) => a.id === "5356")).toMatchObject({ fromProtocolUsd: 49900 });

    // A full liquidation: account 1922's MON long, 4,157 MON at $0.027636 (≈ $114.88), −$6.62 realized.
    const liq = await indexer.process({ chains: { 143: { startBlock: 111_195_974, endBlock: 111_195_974 } } });
    const [l] = sets(liq, "PerplLiquidation");
    t.expect(l).toMatchObject({ account: "1922", perpId: 10, side: "long", full: true });
    t.expect(l!.notionalUsd as number).toBeCloseTo(114.88, 2);
    t.expect(l!.pnlUsd as number).toBeCloseTo(-6.623056, 6);
    t.expect(sets(liq, "PerplAccount").find((a) => a.id === "1922")).toMatchObject({ liquidations: 1 });
    t.expect(sets(liq, "PerplDaily").at(-1)).toMatchObject({ liquidations: 1 });

    // A deposit: 11 AUSD into account 5424.
    const deposit = await indexer.process({ chains: { 143: { startBlock: 111_533_181, endBlock: 111_533_181 } } });
    t.expect(sets(deposit, "PerplAccount").find((a) => a.id === "5424")).toMatchObject({ deposits: 1, depositedUsd: 11 });
    t.expect(sets(deposit, "PerplDaily").at(-1)).toMatchObject({ deposits: 1, depositedUsd: 11 });
  });
});
