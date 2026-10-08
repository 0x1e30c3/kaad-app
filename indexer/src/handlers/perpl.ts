/*
 * Perpl perps on Monad mainnet, low-volume events only, so the whole history stays inside Envio's free plan (100k
 * events): markets (decimals), accounts with their deposits / withdrawals, every liquidation, and per-day flows.
 * Closes and fills (~50k a day) are left out on purpose: the app reads open positions from the contract and derives
 * all-time PnL as live equity minus net deposits.
 */
import { indexer, type EvmOnEventContext } from "envio";

type Ctx = EvmOnEventContext;
const usd = (v: bigint) => Number(v) / 1e6; // AUSD, 6 decimals
const dayOf = (ts: number) => Math.floor(ts / 86400);

type DailyAdd = Partial<Record<"newAccounts" | "deposits" | "depositedUsd" | "withdrawals" | "withdrawnUsd" | "liquidations" | "liquidatedUsd", number>>;

async function daily(context: Ctx, ts: number, add: DailyAdd) {
  const day = dayOf(ts);
  const d = (await context.PerplDaily.get(String(day))) ?? { id: String(day), day, newAccounts: 0, deposits: 0, depositedUsd: 0, withdrawals: 0, withdrawnUsd: 0, liquidations: 0, liquidatedUsd: 0 };
  const next = { ...d };
  for (const [k, v] of Object.entries(add) as [keyof DailyAdd, number][]) next[k] += v;
  context.PerplDaily.set(next);
}

const emptyAccount = (id: string, ts: number) => ({ id, address: "", deposits: 0, depositedUsd: 0, withdrawals: 0, withdrawnUsd: 0, liquidations: 0, liquidatedUsd: 0, createdAt: ts, lastAt: ts });

// ---------------------------------------------------------------- markets and accounts

indexer.onEvent({ contract: "PerplExchange", event: "ContractAdded" }, async ({ event, context }) => {
  const p = event.params;
  context.PerplMarket.set({ id: p.perpId.toString(), symbol: p.symbol || p.name, priceDecimals: Number(p.priceDecimals), lotDecimals: Number(p.lotDecimals) });
});

indexer.onEvent({ contract: "PerplExchange", event: "ContractAddedV2" }, async ({ event, context }) => {
  const p = event.params;
  context.PerplMarket.set({ id: p.perpId.toString(), symbol: p.symbol || p.name, priceDecimals: Number(p.priceDecimals), lotDecimals: Number(p.lotDecimals) });
});

indexer.onEvent({ contract: "PerplExchange", event: "AccountCreated" }, async ({ event, context }) => {
  const id = event.params.id.toString();
  const ts = event.block.timestamp;
  const a = (await context.PerplAccount.get(id)) ?? emptyAccount(id, ts);
  context.PerplAccount.set({ ...a, address: event.params.account.toLowerCase(), createdAt: ts });
  await daily(context, ts, { newAccounts: 1 });
});

// ---------------------------------------------------------------- money in and out

indexer.onEvent({ contract: "PerplExchange", event: "CollateralDeposit" }, async ({ event, context }) => {
  const id = event.params.accountId.toString();
  const ts = event.block.timestamp;
  const value = usd(event.params.amountCNS);
  const a = (await context.PerplAccount.get(id)) ?? emptyAccount(id, ts);
  context.PerplAccount.set({ ...a, deposits: a.deposits + 1, depositedUsd: a.depositedUsd + value, lastAt: ts });
  await daily(context, ts, { deposits: 1, depositedUsd: value });
});

indexer.onEvent({ contract: "PerplExchange", event: "CollateralWithdrawal" }, async ({ event, context }) => {
  const id = event.params.accountId.toString();
  const ts = event.block.timestamp;
  const value = usd(event.params.amountCNS);
  const a = (await context.PerplAccount.get(id)) ?? emptyAccount(id, ts);
  context.PerplAccount.set({ ...a, withdrawals: a.withdrawals + 1, withdrawnUsd: a.withdrawnUsd + value, lastAt: ts });
  await daily(context, ts, { withdrawals: 1, withdrawnUsd: value });
});

// ---------------------------------------------------------------- liquidations

indexer.onEvent({ contract: "PerplExchange", event: "PositionLiquidated" }, async ({ event, context }) => {
  const p = event.params;
  const ts = event.block.timestamp;
  const id = p.posAccountId.toString();
  const m = await context.PerplMarket.get(p.perpId.toString());
  const price = m ? Number(p.liqPricePNS) / 10 ** m.priceDecimals : 0;
  const notional = m ? (Number(p.liqLotLNS) / 10 ** m.lotDecimals) * price : 0;
  const a = (await context.PerplAccount.get(id)) ?? emptyAccount(id, ts);
  context.PerplAccount.set({ ...a, liquidations: a.liquidations + 1, liquidatedUsd: a.liquidatedUsd + notional, lastAt: ts });
  context.PerplLiquidation.set({
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    account: id,
    address: a.address,
    perpId: Number(p.perpId),
    symbol: m?.symbol ?? String(p.perpId),
    side: p.positionType === 0n ? "long" : "short",
    notionalUsd: notional,
    price,
    pnlUsd: usd(p.deltaPnlCNS) + usd(p.fundingCNS),
    full: p.posLotLNS === 0n,
    timestamp: ts,
  });
  await daily(context, ts, { liquidations: 1, liquidatedUsd: notional });
});
