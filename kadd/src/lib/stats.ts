// Public traction numbers for the Kadd testnet venue. Contract state (pools, clubs, faucet supply) is always read;
// trade counts, volume and unique wallets need event history, which comes from Envio HyperRPC when ENVIO_API_TOKEN is
// set (the public RPC caps eth_getLogs at 100 blocks, ~40 seconds of Monad history; HyperRPC serves any range).
import "server-only";
import { createPublicClient, erc20Abi, formatUnits, getAbiItem, http, zeroAddress, type Address } from "viem";
import { kaddClubAbi, kaddClubFactoryAbi, kaddPoolAbi, kaddVenueAbi, mirrorTokenAbi } from "./abi";
import { CLUB_FACTORY, STRATEGIES, TUSDC, VENUE } from "./addresses";
import { chain, publicClient } from "./chain";

const DEPLOY_BLOCK = 67_481_453; // KaddVenue deployment
const HYPERRPC = "https://monad-testnet.rpc.hypersync.xyz/";
const SEED_QUOTE = 50_000;
const usdc = (v: bigint) => Number(formatUnits(v, 6));

export type PoolStat = { pool: Address; symbol: string; source: Address; liquidity: number; price: number; trades: number | null; volume: number | null };
export type Stats = {
  pools: PoolStat[];
  poolLiquidity: number;
  clubs: number;
  clubTvl: number;
  faucetClaims: number;
  strategies: number | null;
  activity: { trades: number; volume: number; traders: number; deposits: number; since: number } | null;
};

export async function getStats(): Promise<Stats> {
  const c = publicClient;
  const [poolAddrs, clubCount, supply, strategies] = await Promise.all([
    c.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "allPools" }),
    c.readContract({ address: CLUB_FACTORY, abi: kaddClubFactoryAbi, functionName: "clubCount" }),
    c.readContract({ address: TUSDC, abi: erc20Abi, functionName: "totalSupply" }),
    STRATEGIES === zeroAddress
      ? null
      : c.readContract({ address: STRATEGIES, abi: [{ type: "function", name: "count", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const, functionName: "count" }).catch(() => null),
  ]);

  const poolInfo = await c.multicall({
    allowFailure: false,
    contracts: poolAddrs.flatMap((p) => [
      { address: p, abi: kaddPoolAbi, functionName: "reserveQuote" },
      { address: p, abi: kaddPoolAbi, functionName: "price" },
      { address: p, abi: kaddPoolAbi, functionName: "baseToken" },
    ] as const),
  });
  const bases = poolAddrs.map((_, i) => poolInfo[i * 3 + 2] as Address);
  const meta = await c.multicall({
    allowFailure: false,
    contracts: bases.flatMap((b) => [
      { address: b, abi: mirrorTokenAbi, functionName: "symbol" },
      { address: b, abi: mirrorTokenAbi, functionName: "source" },
    ] as const),
  });

  const clubAddrs = clubCount
    ? await c.multicall({
        allowFailure: false,
        contracts: Array.from({ length: Number(clubCount) }, (_, i) => ({ address: CLUB_FACTORY, abi: kaddClubFactoryAbi, functionName: "clubs", args: [BigInt(i)] }) as const),
      })
    : [];
  const clubBalances = clubAddrs.length
    ? await c.multicall({ allowFailure: false, contracts: clubAddrs.map((a) => ({ address: a, abi: kaddClubAbi, functionName: "quoteBalance" }) as const) })
    : [];

  const activity = await readActivity(poolAddrs, clubAddrs).catch(() => null);
  const pools: PoolStat[] = poolAddrs.map((pool, i) => ({
    pool,
    symbol: meta[i * 2] as string,
    source: meta[i * 2 + 1] as Address,
    liquidity: usdc(poolInfo[i * 3] as bigint) * 2,
    price: usdc(poolInfo[i * 3 + 1] as bigint),
    trades: activity?.perPool.get(pool.toLowerCase())?.trades ?? (activity ? 0 : null),
    volume: activity?.perPool.get(pool.toLowerCase())?.volume ?? (activity ? 0 : null),
  }));
  pools.sort((a, b) => (b.volume ?? b.liquidity) - (a.volume ?? a.liquidity));

  return {
    pools,
    poolLiquidity: pools.reduce((s, p) => s + p.liquidity, 0),
    clubs: Number(clubCount),
    clubTvl: clubBalances.reduce((s, v) => s + usdc(v), 0),
    // Every tUSDC not seeded into a pool came from the faucet, 1,000 per claim.
    faucetClaims: Math.max(0, Math.round((usdc(supply) - SEED_QUOTE * poolAddrs.length) / 1_000)),
    strategies: strategies === null ? null : Number(strategies),
    activity: activity && { trades: activity.trades, volume: activity.volume, traders: activity.traders, deposits: activity.deposits, since: DEPLOY_BLOCK },
  };
}

/** Swap + club deposit history since the venue deploy, via Envio HyperRPC. Null when no token is configured. */
async function readActivity(pools: readonly Address[], clubs: readonly Address[]) {
  const token = process.env.ENVIO_API_TOKEN;
  if (!token) return null;
  if (!pools.length) return { perPool: new Map<string, { trades: number; volume: number }>(), trades: 0, volume: 0, traders: 0, deposits: 0 };
  const hyper = createPublicClient({ chain, transport: http(HYPERRPC + token) });
  const fromBlock = BigInt(DEPLOY_BLOCK);
  const [swaps, deposits] = await Promise.all([
    hyper.getLogs({ address: [...pools], event: getAbiItem({ abi: kaddPoolAbi, name: "Swap" }), fromBlock }),
    clubs.length ? hyper.getLogs({ address: [...clubs], event: getAbiItem({ abi: kaddClubAbi, name: "Deposited" }), fromBlock }) : [],
  ]);

  const perPool = new Map<string, { trades: number; volume: number }>();
  const traders = new Set<string>();
  let volume = 0;
  for (const l of swaps) {
    const v = usdc(l.args.isBuy ? l.args.amountIn! : l.args.amountOut!);
    const p = perPool.get(l.address.toLowerCase()) ?? { trades: 0, volume: 0 };
    perPool.set(l.address.toLowerCase(), { trades: p.trades + 1, volume: p.volume + v });
    traders.add(l.args.trader!.toLowerCase());
    volume += v;
  }
  for (const l of deposits) traders.add(l.args.member!.toLowerCase());
  return { perPool, trades: swaps.length, volume, traders: traders.size, deposits: deposits.length };
}
