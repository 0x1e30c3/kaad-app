/*
 * Perpl perps on Monad mainnet. Three views, all from Exchange events:
 *   - per trader: realized PnL (close, partial close, flip, liquidation), all time and per day,
 *   - per close: a wallet's trade history with hold time (PerplClose),
 *   - per day: protocol health (volume, fees, active traders, new accounts, deposits / withdrawals, liquidations).
 * Collateral is AUSD (6 decimals); fills and liquidations are valued with each market's price / lot decimals
 * (PerplMarket, from ContractAdded).
 */
import { indexer, type EvmOnEventContext } from "envio";

type Ctx = EvmOnEventContext;
const usd = (v: bigint) => Number(v) / 1e6;
const dayOf = (ts: number) => Math.floor(ts / 86400);

type DailyAdd = Partial<Record<"volumeUsd" | "feesUsd" | "fills" | "activeTraders" | "newAccounts" | "opens" | "deposits" | "depositedUsd" | "withdrawals" | "withdrawnUsd" | "liquidations" | "liquidatedUsd" | "realizedPnlUsd", number>>;

async function daily(context: Ctx, ts: number, add: DailyAdd) {
  const day = dayOf(ts);
  const d = (await context.PerplDaily.get(String(day))) ?? {
    id: String(day), day, volumeUsd: 0, feesUsd: 0, fills: 0, activeTraders: 0, newAccounts: 0, opens: 0, deposits: 0, depositedUsd: 0, withdrawals: 0, withdrawnUsd: 0, liquidations: 0, liquidatedUsd: 0, realizedPnlUsd: 0,
  };
  const next = { ...d };
  for (const [k, v] of Object.entries(add) as [keyof DailyAdd, number][]) next[k] += v;
  context.PerplDaily.set(next);
}

/** Counts the account as active today (once). */
async function active(context: Ctx, accountId: bigint, ts: number) {
  const id = `${dayOf(ts)}_${accountId}`;
  if (await context.PerplActive.get(id)) return;
  context.PerplActive.set({ id });
  await daily(context, ts, { activeTraders: 1 });
}

/** USD value of `lot` at `price` in a market, or 0 for a market we haven't seen added. */
async function notional(context: Ctx, perpId: bigint, price: bigint, lot: bigint) {
  const m = await context.PerplMarket.get(perpId.toString());
  return m ? (Number(lot) / 10 ** m.lotDecimals) * (Number(price) / 10 ** m.priceDecimals) : 0;
}

type Kind = "close" | "partial" | "flip" | "liquidation";

async function realize(context: Ctx, e: { chainId: number; block: { number: number; timestamp: number }; logIndex: number }, p: { perpId: bigint; accountId: bigint; positionType: bigint; pnl: bigint; funding: bigint }, kind: Kind) {
  const ts = e.block.timestamp;
  const id = p.accountId.toString();
  const total = usd(p.pnl) + usd(p.funding);
  const closed = kind === "close" || kind === "liquidation";
  const win = closed && total > 0 ? 1 : 0;
  const liq = kind === "liquidation" ? 1 : 0;

  const t = (await context.PerplTrader.get(id)) ?? { id, address: "", realizedPnlUsd: 0, fundingUsd: 0, closes: 0, wins: 0, liquidations: 0, partials: 0, firstAt: ts, lastAt: ts };
  context.PerplTrader.set({
    ...t,
    realizedPnlUsd: t.realizedPnlUsd + total,
    fundingUsd: t.fundingUsd + usd(p.funding),
    closes: t.closes + (closed ? 1 : 0),
    wins: t.wins + win,
    liquidations: t.liquidations + liq,
    partials: t.partials + (closed ? 0 : 1),
    lastAt: ts,
  });

  const day = dayOf(ts);
  const dayId = `${id}_${day}`;
  const d = (await context.PerplTraderDay.get(dayId)) ?? { id: dayId, account: id, address: t.address, day, pnlUsd: 0, closes: 0, wins: 0, liquidations: 0 };
  context.PerplTraderDay.set({ ...d, pnlUsd: d.pnlUsd + total, closes: d.closes + (closed ? 1 : 0), wins: d.wins + win, liquidations: d.liquidations + liq });

  const posId = `${id}_${p.perpId}`;
  const pos = await context.PerplPosition.get(posId);
  const market = await context.PerplMarket.get(p.perpId.toString());
  context.PerplClose.set({
    id: `${e.chainId}_${e.block.number}_${e.logIndex}`,
    account: id,
    address: t.address,
    perpId: Number(p.perpId),
    symbol: market?.symbol ?? String(p.perpId),
    side: p.positionType === 0n ? "long" : "short",
    kind,
    pnlUsd: total,
    holdSec: pos ? Math.max(0, ts - pos.openedAt) : 0,
    timestamp: ts,
  });
  if (kind === "flip") context.PerplPosition.set({ id: posId, openedAt: ts }); // the flipped position starts now

  await daily(context, ts, { realizedPnlUsd: total });
  await active(context, p.accountId, ts);
}

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
  const t = await context.PerplTrader.get(id);
  context.PerplTrader.set({ ...(t ?? { id, realizedPnlUsd: 0, fundingUsd: 0, closes: 0, wins: 0, liquidations: 0, partials: 0, firstAt: ts, lastAt: ts }), address: event.params.account.toLowerCase() });
  await daily(context, ts, { newAccounts: 1 });
});

indexer.onEvent({ contract: "PerplExchange", event: "CollateralDeposit" }, async ({ event, context }) => {
  await daily(context, event.block.timestamp, { deposits: 1, depositedUsd: usd(event.params.amountCNS) });
});

indexer.onEvent({ contract: "PerplExchange", event: "CollateralWithdrawal" }, async ({ event, context }) => {
  await daily(context, event.block.timestamp, { withdrawals: 1, withdrawnUsd: usd(event.params.amountCNS) });
});

// ---------------------------------------------------------------- fills: volume and fees

// Every fill has exactly one maker side, so maker fills count volume once. Taker events carry the taker's fee.
for (const event of ["MakerOrderFilled", "MakerOrderFilledV2"] as const) {
  indexer.onEvent({ contract: "PerplExchange", event }, async ({ event: e, context }) => {
    const p = e.params;
    await daily(context, e.block.timestamp, { fills: 1, volumeUsd: await notional(context, p.perpId, p.pricePNS, p.lotLNS), feesUsd: usd(p.feeCNS) });
  });
}
for (const event of ["TakerOrderFilled", "TakerOrderFilledV2"] as const) {
  indexer.onEvent({ contract: "PerplExchange", event }, async ({ event: e, context }) => {
    await daily(context, e.block.timestamp, { feesUsd: usd(e.params.feeCNS) });
  });
}

// ---------------------------------------------------------------- positions

for (const event of ["PositionOpened", "PositionOpenedV2"] as const) {
  indexer.onEvent({ contract: "PerplExchange", event }, async ({ event: e, context }) => {
    const p = e.params;
    context.PerplPosition.set({ id: `${p.accountId}_${p.perpId}`, openedAt: e.block.timestamp });
    await daily(context, e.block.timestamp, { opens: 1 });
    await active(context, p.accountId, e.block.timestamp);
  });
}
for (const event of ["PositionIncreased", "PositionIncreasedV2"] as const) {
  indexer.onEvent({ contract: "PerplExchange", event }, async ({ event: e, context }) => {
    await active(context, e.params.accountId, e.block.timestamp);
  });
}

indexer.onEvent({ contract: "PerplExchange", event: "PositionClosed" }, async ({ event, context }) => {
  const p = event.params;
  await realize(context, event, { perpId: p.perpId, accountId: p.accountId, positionType: p.positionType, pnl: p.deltaPnlCNS, funding: p.fundingCNS }, "close");
});

indexer.onEvent({ contract: "PerplExchange", event: "PositionDecreased" }, async ({ event, context }) => {
  const p = event.params;
  await realize(context, event, { perpId: p.perpId, accountId: p.accountId, positionType: p.positionType, pnl: p.deltaPnlCNS, funding: p.fundingCNS }, "partial");
});

indexer.onEvent({ contract: "PerplExchange", event: "PositionInverted" }, async ({ event, context }) => {
  const p = event.params;
  // The event reports the new side; the PnL belongs to the side that was closed.
  await realize(context, event, { perpId: p.perpId, accountId: p.accountId, positionType: p.positionType === 0n ? 1n : 0n, pnl: p.deltaPnlCNS, funding: p.fundingCNS }, "flip");
});

indexer.onEvent({ contract: "PerplExchange", event: "PositionLiquidated" }, async ({ event, context }) => {
  const p = event.params;
  // A liquidation can be partial; only one that empties the position counts as a close.
  const full = p.posLotLNS === 0n;
  await realize(context, event, { perpId: p.perpId, accountId: p.posAccountId, positionType: p.positionType, pnl: p.deltaPnlCNS, funding: p.fundingCNS }, full ? "liquidation" : "partial");
  await daily(context, event.block.timestamp, { liquidations: 1, liquidatedUsd: await notional(context, p.perpId, p.liqPricePNS, p.liqLotLNS) });
});
