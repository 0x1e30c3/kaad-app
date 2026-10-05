/*
 * Kadd on Monad testnet. Swaps are attributed to whoever's money they were: a wallet trading directly, a club, or
 * — for swaps made by KaddStrategies / KaddCopy — the owner of the strategy or copy vault. Those contracts swap first
 * and emit their own event after, so the swap is recorded first and re-attributed when that event arrives.
 */
import { indexer, type EvmOnEventContext } from "envio";

const STRATEGIES = "0xc12684b7063e3c749f0227539601a7b370073cea";
const COPY = "0x27bb7d06af7ba8ea359cfe00a628145ed0bf1661";

const usd = (v: bigint) => Number(v) / 1e6; // tUSDC has 6 decimals
const tokens = (v: bigint) => Number(v) / 1e18; // mirror tokens have 18
const dayOf = (ts: number) => Math.floor(ts / 86400);

type Ctx = EvmOnEventContext;

async function daily(context: Ctx, ts: number, add: { trades?: number; volumeUsd?: number; newTraders?: number; clubDeposits?: number; depositedUsd?: number; copies?: number; strategiesCreated?: number }) {
  const day = dayOf(ts);
  const d = (await context.DailyStat.get(String(day))) ?? { id: String(day), day, trades: 0, volumeUsd: 0, newTraders: 0, clubDeposits: 0, depositedUsd: 0, copies: 0, strategiesCreated: 0 };
  context.DailyStat.set({
    ...d,
    trades: d.trades + (add.trades ?? 0),
    volumeUsd: d.volumeUsd + (add.volumeUsd ?? 0),
    newTraders: d.newTraders + (add.newTraders ?? 0),
    clubDeposits: d.clubDeposits + (add.clubDeposits ?? 0),
    depositedUsd: d.depositedUsd + (add.depositedUsd ?? 0),
    copies: d.copies + (add.copies ?? 0),
    strategiesCreated: d.strategiesCreated + (add.strategiesCreated ?? 0),
  });
}

/** Adds one trade to an account's running totals. */
async function credit(context: Ctx, who: string, kind: "wallet" | "club", t: { isBuy: boolean; usd: number; ts: number; via?: "strategy" | "copy" }) {
  const prev = await context.Trader.get(who);
  if (!prev) await daily(context, t.ts, { newTraders: 1 });
  const a = prev ?? { id: who, kind, trades: 0, buys: 0, sells: 0, volumeUsd: 0, boughtUsd: 0, soldUsd: 0, viaStrategies: 0, viaCopy: 0, firstAt: t.ts, lastAt: t.ts };
  context.Trader.set({
    ...a,
    trades: a.trades + 1,
    buys: a.buys + (t.isBuy ? 1 : 0),
    sells: a.sells + (t.isBuy ? 0 : 1),
    volumeUsd: a.volumeUsd + t.usd,
    boughtUsd: a.boughtUsd + (t.isBuy ? t.usd : 0),
    soldUsd: a.soldUsd + (t.isBuy ? 0 : t.usd),
    viaStrategies: a.viaStrategies + (t.via === "strategy" ? 1 : 0),
    viaCopy: a.viaCopy + (t.via === "copy" ? 1 : 0),
    lastAt: t.ts,
  });
}

/** Re-attributes the swap in this transaction to `owner` (strategy / copy) and credits them. */
async function attribute(context: Ctx, txHash: string, owner: string, via: "strategy" | "copy", ts: number) {
  const link = await context.TxSwap.get(txHash);
  const swap = link && (await context.Swap.get(link.swap));
  if (!swap) return;
  context.Swap.set({ ...swap, trader: owner });
  await credit(context, owner, "wallet", { isBuy: swap.isBuy, usd: swap.usd, ts, via });
}

// ---------------------------------------------------------------- pools

indexer.contractRegister({ contract: "KaddVenue", event: "MirrorCreated" }, async ({ event, context }) => {
  context.chain.KaddPool.add(event.params.pool);
});

indexer.onEvent({ contract: "KaddVenue", event: "MirrorCreated" }, async ({ event, context }) => {
  context.Pool.set({
    id: event.params.pool.toLowerCase(),
    source: event.params.source.toLowerCase(),
    token: event.params.token.toLowerCase(),
    symbol: event.params.symbol,
    createdAt: event.block.timestamp,
    trades: 0,
    buys: 0,
    sells: 0,
    volumeUsd: 0,
    lastPriceUsd: 0,
  });
});

indexer.onEvent({ contract: "KaddPool", event: "Swap" }, async ({ event, context }) => {
  const { trader: raw, isBuy, amountIn, amountOut } = event.params;
  const ts = event.block.timestamp;
  const trader = raw.toLowerCase();
  const value = isBuy ? usd(amountIn) : usd(amountOut);
  const amount = isBuy ? tokens(amountOut) : tokens(amountIn);
  const club = await context.Club.get(trader);
  const kind = trader === STRATEGIES ? "strategy" : trader === COPY ? "copy" : club ? "club" : "wallet";
  const id = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const pool = event.srcAddress.toLowerCase();

  context.Swap.set({ id, pool, trader, kind, isBuy, usd: value, tokens: amount, priceUsd: amount ? value / amount : 0, timestamp: ts, block: event.block.number, txHash: event.transaction.hash });
  context.TxSwap.set({ id: event.transaction.hash, swap: id });

  const p = await context.Pool.get(pool);
  if (p) context.Pool.set({ ...p, trades: p.trades + 1, buys: p.buys + (isBuy ? 1 : 0), sells: p.sells + (isBuy ? 0 : 1), volumeUsd: p.volumeUsd + value, lastPriceUsd: amount ? value / amount : p.lastPriceUsd });
  await daily(context, ts, { trades: 1, volumeUsd: value });

  if (club) context.Club.set({ ...club, trades: club.trades + 1, volumeUsd: club.volumeUsd + value });
  if (kind === "wallet" || kind === "club") await credit(context, trader, kind, { isBuy, usd: value, ts });
  // strategy / copy swaps are credited to their owner by the Executed / Copied handler right after.
});

// ---------------------------------------------------------------- clubs

indexer.contractRegister({ contract: "KaddClubFactory", event: "ClubCreated" }, async ({ event, context }) => {
  context.chain.KaddClub.add(event.params.club);
});

indexer.onEvent({ contract: "KaddClubFactory", event: "ClubCreated" }, async ({ event, context }) => {
  context.Club.set({
    id: event.params.club.toLowerCase(),
    name: event.params.name,
    captain: event.params.captain.toLowerCase(),
    createdAt: event.block.timestamp,
    deposits: 0,
    depositedUsd: 0,
    redemptions: 0,
    trades: 0,
    volumeUsd: 0,
  });
});

indexer.onEvent({ contract: "KaddClub", event: "Deposited" }, async ({ event, context }) => {
  const id = event.srcAddress.toLowerCase();
  const value = usd(event.params.amount);
  context.ClubDeposit.set({ id: `${event.chainId}_${event.block.number}_${event.logIndex}`, club: id, member: event.params.member.toLowerCase(), usd: value, shares: event.params.shares, timestamp: event.block.timestamp });
  const c = await context.Club.get(id);
  if (c) context.Club.set({ ...c, deposits: c.deposits + 1, depositedUsd: c.depositedUsd + value });
  await daily(context, event.block.timestamp, { clubDeposits: 1, depositedUsd: value });
});

indexer.onEvent({ contract: "KaddClub", event: "Redeemed" }, async ({ event, context }) => {
  const c = await context.Club.get(event.srcAddress.toLowerCase());
  if (c) context.Club.set({ ...c, redemptions: c.redemptions + 1 });
});

// ---------------------------------------------------------------- strategies

indexer.onEvent({ contract: "KaddStrategies", event: "Created" }, async ({ event, context }) => {
  const p = event.params;
  context.Strategy.set({ id: p.id.toString(), owner: p.owner.toLowerCase(), pool: p.pool.toLowerCase(), isBuy: p.isBuy, amount: p.amount, executions: 0, cancelled: false, createdAt: event.block.timestamp });
  await daily(context, event.block.timestamp, { strategiesCreated: 1 });
});

indexer.onEvent({ contract: "KaddStrategies", event: "Executed" }, async ({ event, context }) => {
  const s = await context.Strategy.get(event.params.id.toString());
  if (!s) return;
  context.Strategy.set({ ...s, executions: s.executions + 1 });
  await attribute(context, event.transaction.hash, s.owner, "strategy", event.block.timestamp);
});

indexer.onEvent({ contract: "KaddStrategies", event: "Cancelled" }, async ({ event, context }) => {
  const s = await context.Strategy.get(event.params.id.toString());
  if (s) context.Strategy.set({ ...s, cancelled: true });
});

// ---------------------------------------------------------------- copy vaults

indexer.onEvent({ contract: "KaddCopy", event: "Followed" }, async ({ event, context }) => {
  const p = event.params;
  context.CopyVault.set({
    id: p.id.toString(),
    owner: p.owner.toLowerCase(),
    leader: p.leader.toLowerCase(),
    perTradeUsd: usd(p.perTrade),
    dailyCapUsd: usd(p.dailyCap),
    depositedUsd: usd(p.deposit),
    copySells: p.copySells,
    copies: 0,
    active: true,
    createdAt: event.block.timestamp,
  });
});

indexer.onEvent({ contract: "KaddCopy", event: "Funded" }, async ({ event, context }) => {
  const v = await context.CopyVault.get(event.params.id.toString());
  if (v) context.CopyVault.set({ ...v, depositedUsd: v.depositedUsd + usd(event.params.amount) });
});

indexer.onEvent({ contract: "KaddCopy", event: "Copied" }, async ({ event, context }) => {
  const p = event.params;
  const v = await context.CopyVault.get(p.id.toString());
  if (!v) return;
  const value = p.isBuy ? usd(p.amountIn) : usd(p.amountOut);
  context.CopyTrade.set({ id: `${event.chainId}_${event.block.number}_${event.logIndex}`, vault: v.id, leaderTx: p.leaderTx, pool: p.pool.toLowerCase(), isBuy: p.isBuy, usd: value, timestamp: event.block.timestamp, txHash: event.transaction.hash });
  context.CopyVault.set({ ...v, copies: v.copies + 1 });
  await daily(context, event.block.timestamp, { copies: 1 });
  await attribute(context, event.transaction.hash, v.owner, "copy", event.block.timestamp);
});

indexer.onEvent({ contract: "KaddCopy", event: "Closed" }, async ({ event, context }) => {
  const v = await context.CopyVault.get(event.params.id.toString());
  if (v) context.CopyVault.set({ ...v, active: false });
});
