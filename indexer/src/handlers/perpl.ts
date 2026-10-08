/*
 * Perpl perps on Monad mainnet: realized PnL per account. Every event that realizes PnL (close, partial close, flip,
 * liquidation) carries the price PnL and funding it settled, in AUSD (6 decimals), so no per-market scaling is needed.
 */
import { indexer, type EvmOnEventContext } from "envio";

const usd = (v: bigint) => Number(v) / 1e6;
const dayOf = (ts: number) => Math.floor(ts / 86400);

type Kind = "close" | "partial" | "liquidation";

async function realize(context: EvmOnEventContext, accountId: bigint, pnl: bigint, funding: bigint, kind: Kind, ts: number) {
  const id = accountId.toString();
  const total = usd(pnl) + usd(funding);
  const closed = kind !== "partial";
  const win = closed && total > 0 ? 1 : 0;
  const liq = kind === "liquidation" ? 1 : 0;
  const t = (await context.PerplTrader.get(id)) ?? { id, address: "", realizedPnlUsd: 0, fundingUsd: 0, closes: 0, wins: 0, liquidations: 0, partials: 0, firstAt: ts, lastAt: ts };
  context.PerplTrader.set({
    ...t,
    realizedPnlUsd: t.realizedPnlUsd + total,
    fundingUsd: t.fundingUsd + usd(funding),
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
}

indexer.onEvent({ contract: "PerplExchange", event: "AccountCreated" }, async ({ event, context }) => {
  const id = event.params.id.toString();
  const ts = event.block.timestamp;
  const t = await context.PerplTrader.get(id);
  context.PerplTrader.set({ ...(t ?? { id, realizedPnlUsd: 0, fundingUsd: 0, closes: 0, wins: 0, liquidations: 0, partials: 0, firstAt: ts, lastAt: ts }), address: event.params.account.toLowerCase() });
});

indexer.onEvent({ contract: "PerplExchange", event: "PositionClosed" }, async ({ event, context }) => {
  const p = event.params;
  await realize(context, p.accountId, p.deltaPnlCNS, p.fundingCNS, "close", event.block.timestamp);
});

indexer.onEvent({ contract: "PerplExchange", event: "PositionDecreased" }, async ({ event, context }) => {
  const p = event.params;
  await realize(context, p.accountId, p.deltaPnlCNS, p.fundingCNS, "partial", event.block.timestamp);
});

indexer.onEvent({ contract: "PerplExchange", event: "PositionInverted" }, async ({ event, context }) => {
  const p = event.params;
  await realize(context, p.accountId, p.deltaPnlCNS, p.fundingCNS, "partial", event.block.timestamp);
});

indexer.onEvent({ contract: "PerplExchange", event: "PositionLiquidated" }, async ({ event, context }) => {
  const p = event.params;
  // A liquidation can be partial; only one that empties the position counts as a close.
  await realize(context, p.posAccountId, p.deltaPnlCNS, p.fundingCNS, p.posLotLNS === 0n ? "liquidation" : "partial", event.block.timestamp);
});
