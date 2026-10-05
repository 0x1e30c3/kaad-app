// Real leaderboard from KaddVenue Swap events (via Envio HyperRPC). A Swap's `trader` is whoever called the pool:
// a wallet, a club contract (club trades), or KaddStrategies (attributed back to the strategy owner by tx hash).
import "server-only";
import { getAbiItem, type Address } from "viem";
import { kaddClubAbi, kaddClubFactoryAbi, kaddCopyAbi, kaddPoolAbi, kaddStrategiesAbi, kaddVenueAbi } from "./abi";
import { CLUB_FACTORY, COPY, STRATEGIES, VENUE } from "./addresses";
import { publicClient } from "./chain";
import { DEPLOY_BLOCK, hyperClient } from "./stats";
import { swr } from "./cache";
import { profiles } from "./nns";

export type Period = "1" | "7" | "30";
export type BoardRow = {
  address: Address;
  name: string | null; // club name; null for wallets
  nns: string | null; // wallet's .nad name, if any
  avatar: string | null;
  pnl: number;
  roi: number;
  win: number | null; // % of sells above average cost; null when nothing was sold
  volume: number;
  trades: number;
  series: number[]; // PnL at 8 evenly spaced points across the period, holdings marked at today's pool price
};
export type Board = { ready: boolean; failed?: boolean; traders: Record<Period, BoardRow[]>; clubs: Record<Period, BoardRow[]> };

export type Trade = { who: string; pool: string; isBuy: boolean; quote: number; base: number; ago: number };

const DAYS: Record<Period, number> = { "1": 1, "7": 7, "30": 30 };
const empty = (): Record<Period, BoardRow[]> => ({ "1": [], "7": [], "30": [] });

/** Score one account's trades inside a window. Exported for the self-check in leaderboard.check.ts. */
export function score(trades: Trade[], price: Map<string, number>, days: number) {
  const span = days * 86400;
  const inWindow = trades.filter((t) => t.ago < span).sort((a, b) => b.ago - a.ago); // oldest first
  const pnlUpTo = (cut: number) => {
    const held = new Map<string, number>();
    let cash = 0;
    for (const t of inWindow) {
      if (t.ago < cut) break;
      cash += t.isBuy ? -t.quote : t.quote;
      held.set(t.pool, (held.get(t.pool) ?? 0) + (t.isBuy ? t.base : -t.base));
    }
    for (const [pool, base] of held) cash += base * (price.get(pool) ?? 0);
    return cash;
  };
  const pos = new Map<string, { base: number; cost: number }>();
  let bought = 0, volume = 0, sells = 0, wins = 0;
  for (const t of inWindow) {
    volume += t.quote;
    const p = pos.get(t.pool) ?? { base: 0, cost: 0 };
    if (t.isBuy) {
      bought += t.quote;
      pos.set(t.pool, { base: p.base + t.base, cost: p.cost + t.quote });
    } else if (p.base > 0) {
      const avg = p.cost / p.base;
      sells++;
      if (t.quote / t.base > avg) wins++;
      const sold = Math.min(t.base, p.base);
      pos.set(t.pool, { base: p.base - sold, cost: p.cost - avg * sold });
    }
  }
  const series = Array.from({ length: 8 }, (_, i) => pnlUpTo(i === 7 ? -1 : (span * (7 - i)) / 7));
  const pnl = series[7];
  return { pnl, roi: bought ? (pnl / bought) * 100 : 0, win: sells ? Math.round((wins / sells) * 100) : null, volume, trades: inWindow.length, series };
}

// The board is optional context, never worth an error page: swr keeps the last good read; with none yet, say so.
export const getLeaderboard = (): Promise<Board> =>
  swr("board", 5 * 60_000, readBoard).catch((e) => {
    console.error("leaderboard read failed", e);
    return { ready: true, failed: true, traders: empty(), clubs: empty() };
  });

async function readBoard(): Promise<Board> {
  const token = process.env.ENVIO_API_TOKEN;
  if (!token) return { ready: false, traders: empty(), clubs: empty() };
  const hyper = hyperClient(token);
  const fromBlock = BigInt(DEPLOY_BLOCK);

  const [pools, clubCount] = await Promise.all([
    publicClient.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "allPools" }),
    publicClient.readContract({ address: CLUB_FACTORY, abi: kaddClubFactoryAbi, functionName: "clubCount" }),
  ]);
  if (!pools.length) return { ready: true, traders: empty(), clubs: empty() };
  const clubAddrs = clubCount
    ? await publicClient.multicall({
        allowFailure: false,
        contracts: Array.from({ length: Number(clubCount) }, (_, i) => ({ address: CLUB_FACTORY, abi: kaddClubFactoryAbi, functionName: "clubs", args: [BigInt(i)] }) as const),
      })
    : [];
  const copyOn = !/^0x0+$/.test(COPY);
  const [prices, clubNames, head, swaps, created, executed, followed, copiedLogs] = await Promise.all([
    publicClient.multicall({ allowFailure: false, contracts: pools.map((p) => ({ address: p, abi: kaddPoolAbi, functionName: "price" }) as const) }),
    clubAddrs.length ? publicClient.multicall({ allowFailure: false, contracts: clubAddrs.map((a) => ({ address: a, abi: kaddClubAbi, functionName: "name" }) as const) }) : [],
    publicClient.getBlockNumber(),
    hyper.getLogs({ address: [...pools], event: getAbiItem({ abi: kaddPoolAbi, name: "Swap" }), fromBlock }),
    hyper.getLogs({ address: STRATEGIES, event: getAbiItem({ abi: kaddStrategiesAbi, name: "Created" }), fromBlock }),
    hyper.getLogs({ address: STRATEGIES, event: getAbiItem({ abi: kaddStrategiesAbi, name: "Executed" }), fromBlock }),
    copyOn ? hyper.getLogs({ address: COPY, event: getAbiItem({ abi: kaddCopyAbi, name: "Followed" }), fromBlock }) : [],
    copyOn ? hyper.getLogs({ address: COPY, event: getAbiItem({ abi: kaddCopyAbi, name: "Copied" }), fromBlock }) : [],
  ]);

  const price = new Map(pools.map((p, i) => [p.toLowerCase(), Number(prices[i]) / 1e6]));
  const ownerOf = new Map(created.map((l) => [l.args.id!, l.args.owner!.toLowerCase()]));
  // Swaps made by KaddStrategies or KaddCopy count for the person whose funds they were.
  const strategyTx = new Map(executed.map((l) => [l.transactionHash, ownerOf.get(l.args.id!)]));
  const followOwner = new Map(followed.map((l) => [l.args.id!, l.args.owner!.toLowerCase()]));
  const copyTx = new Map(copiedLogs.map((l) => [l.transactionHash, followOwner.get(l.args.id!)]));
  const copyAddr = COPY.toLowerCase();
  const clubName = new Map(clubAddrs.map((a, i) => [a.toLowerCase(), clubNames[i] as string]));
  const strategies = STRATEGIES.toLowerCase();

  const byWho = new Map<string, Trade[]>();
  for (const l of swaps) {
    let who = l.args.trader!.toLowerCase();
    if (who === strategies) who = strategyTx.get(l.transactionHash) ?? who;
    else if (who === copyAddr) who = copyTx.get(l.transactionHash) ?? who;
    const isBuy = l.args.isBuy!;
    const t: Trade = {
      who,
      pool: l.address.toLowerCase(),
      isBuy,
      quote: Number(isBuy ? l.args.amountIn! : l.args.amountOut!) / 1e6,
      base: Number(isBuy ? l.args.amountOut! : l.args.amountIn!) / 1e18,
      ago: Number(head - l.blockNumber!) * 0.4, // ~0.4s Monad blocks
    };
    byWho.set(who, [...(byWho.get(who) ?? []), t]);
  }

  const traders = empty();
  const clubs = empty();
  for (const period of Object.keys(DAYS) as Period[]) {
    for (const [who, ts] of byWho) {
      const s = score(ts, price, DAYS[period]);
      if (!s.trades) continue;
      const row = { address: who as Address, name: clubName.get(who) ?? null, nns: null, avatar: null, ...s };
      (clubName.has(who) ? clubs : traders)[period].push(row);
    }
    traders[period].sort((a, b) => b.pnl - a.pnl);
    clubs[period].sort((a, b) => b.pnl - a.pnl);
  }
  // Same keys sign on testnet and mainnet, so a wallet's .nad name and avatar apply here too.
  const names = await profiles([...byWho.keys()].filter((w) => !clubName.has(w)));
  for (const rows of Object.values(traders)) for (const r of rows) Object.assign(r, names.get(r.address));
  return { ready: true, traders, clubs };
}
