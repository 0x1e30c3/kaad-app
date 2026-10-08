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

  it("credits Perpl realized PnL to the account that closed (Monad mainnet)", async (t) => {
    const indexer = createTestIndexer();
    // Perpl's first markets, with the decimals that value fills and liquidations in USD.
    const added = await indexer.process({ chains: { 143: { startBlock: 54_773_025, endBlock: 54_773_029 } } });
    t.expect(sets(added, "PerplMarket").map((m) => m.symbol).length).toBe(2);
    t.expect(sets(added, "PerplMarket")[0]).toMatchObject({ id: "1" });

    // Perpl's very first account.
    const created = await indexer.process({ chains: { 143: { startBlock: 54_972_991, endBlock: 54_972_991 } } });
    t.expect(sets(created, "PerplTrader")[0]).toMatchObject({ id: "1", realizedPnlUsd: 0 });
    t.expect(sets(created, "PerplTrader")[0]!.address).toMatch(/^0x[0-9a-f]{40}$/);

    // Two closes in one block: account 2118 lost $0.004338, account 2192 lost $0.000021 (price PnL, no funding).
    const closes = await indexer.process({ chains: { 143: { startBlock: 111_500_041, endBlock: 111_500_041 } } });
    const last = (id: string) => sets(closes, "PerplTrader").filter((x) => x.id === id).at(-1);
    t.expect(last("2118")).toMatchObject({ closes: 1, wins: 0 });
    t.expect(last("2118")!.realizedPnlUsd).toBeCloseTo(-0.004338, 6);
    t.expect(last("2192")!.realizedPnlUsd).toBeCloseTo(-0.000021, 6);
    t.expect(sets(closes, "PerplTraderDay").some((d) => d.account === "2118")).toBe(true);
    // Each close is a row of the wallet's history, and the day's protocol totals move with it.
    const history = sets(closes, "PerplClose").filter((c) => c.account === "2118");
    t.expect(history.at(-1)).toMatchObject({ kind: "close", side: "long" });
    t.expect(history.at(-1)!.pnlUsd as number).toBeCloseTo(-0.004338, 6);
    const day = sets(closes, "PerplDaily").at(-1)!;
    t.expect(day.activeTraders as number).toBeGreaterThanOrEqual(2);
    t.expect(day.fills as number).toBeGreaterThan(0);
  });
});
