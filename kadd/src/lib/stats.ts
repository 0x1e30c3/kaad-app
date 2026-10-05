// Public traction numbers for the Kadd testnet venue. Contract state (pools, clubs, faucet supply) is always read;
// trade counts, volume and unique wallets need event history, which comes from Envio HyperRPC when ENVIO_API_TOKEN is
// set (the public RPC caps eth_getLogs at 100 blocks, ~40 seconds of Monad history; HyperRPC serves any range).
import "server-only";
import { createPublicClient, erc20Abi, formatUnits, getAbiItem, http, zeroAddress, type Address } from "viem";
import { kaddClubAbi, kaddClubFactoryAbi, kaddPoolAbi, kaddVenueAbi, mirrorTokenAbi } from "./abi";
import { CLUB_FACTORY, STRATEGIES, TUSDC, VENUE } from "./addresses";
import { hourlyCloses, quotes } from "./market";
import { swr } from "./cache";
import { indexedDepositors, indexedSwaps, indexerUrl } from "./indexer";
import { chain, publicClient } from "./chain";

export const DEPLOY_BLOCK = 67_481_453; // KaddVenue deployment
export const HYPERRPC = "https://monad-testnet.rpc.hypersync.xyz/";
/** HyperRPC for full-range getLogs. It rate-limits bursts (429), so retry with a longer backoff than viem's default. */
export const hyperClient = (token: string) => createPublicClient({ chain, transport: http(HYPERRPC + token, { retryCount: 4, retryDelay: 600 }) });
const SEED_QUOTE = 50_000;
const usdc = (v: bigint) => Number(formatUnits(v, 6));

export type PoolStat = {
  pool: Address;
  symbol: string;
  source: Address;
  liquidity: number;
  price: number;
  trades: number | null;
  volume: number | null;
  /** Mainnet reference (DexScreener): logo, price and 24h change of the token this pool mirrors. */
  image: string | null;
  mainnetPrice: number | null;
  change24h: number | null;
  /** Mainnet 24h: hourly closes for the sparkline, and buys/sells for buy pressure. */
  spark: { t: number; v: number }[];
  buys24h: number;
  sells24h: number;
};
export type Stats = {
  /** Set when the chain read failed and these are the last good numbers instead. */
  staleSince?: number;
  pools: PoolStat[];
  poolLiquidity: number;
  clubs: number;
  clubTvl: number;
  faucetClaims: number;
  strategies: number | null;
  activity: {
    trades: number;
    volume: number;
    traders: number;
    deposits: number;
    since: number;
    /** Last 24 hours (hourly) and last 7 days (daily), oldest → newest, with each bucket's start time. */
    hourly: { t: number[]; trades: number[]; volume: number[] };
    daily: { t: number[]; trades: number[]; volume: number[] };
  } | null;
};

// Last good result: the public RPC rate-limits bursts, and an older snapshot beats an error page.
let lastGood: { at: number; stats: Stats } | null = null;

// 5 min: HyperRPC's free quota is ~5 requests/minute, shared with the leaderboard and chart fallback.
export const getStats = () => swr("stats", 5 * 60_000, readStatsOrLast);

async function readStatsOrLast(): Promise<Stats> {
  try {
    const stats = await readStats();
    lastGood = { at: Date.now(), stats };
    return stats;
  } catch (e) {
    if (lastGood) return { ...lastGood.stats, staleSince: lastGood.at };
    throw e;
  }
}

async function readStats(): Promise<Stats> {
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

  const [activity, refs] = await Promise.all([
    readActivity(poolAddrs, clubAddrs).catch(() => null),
    quotes(poolAddrs.map((_, i) => meta[i * 2 + 1] as Address)).catch(() => ({}) as Awaited<ReturnType<typeof quotes>>),
  ]);
  const sparks = await Promise.all(
    poolAddrs.map((_, i) => {
      const src = (meta[i * 2 + 1] as string).toLowerCase();
      const ref = refs[src];
      return ref ? hourlyCloses(ref.pool, src).catch(() => []) : Promise.resolve([]);
    }),
  );
  const pools: PoolStat[] = poolAddrs.map((pool, i) => ({
    pool,
    symbol: meta[i * 2] as string,
    source: meta[i * 2 + 1] as Address,
    liquidity: usdc(poolInfo[i * 3] as bigint) * 2,
    price: usdc(poolInfo[i * 3 + 1] as bigint),
    trades: activity?.perPool.get(pool.toLowerCase())?.trades ?? (activity ? 0 : null),
    volume: activity?.perPool.get(pool.toLowerCase())?.volume ?? (activity ? 0 : null),
    image: refs[(meta[i * 2 + 1] as string).toLowerCase()]?.image ?? null,
    mainnetPrice: refs[(meta[i * 2 + 1] as string).toLowerCase()]?.price ?? null,
    change24h: refs[(meta[i * 2 + 1] as string).toLowerCase()]?.change24h ?? null,
    spark: sparks[i],
    buys24h: refs[(meta[i * 2 + 1] as string).toLowerCase()]?.buys24h ?? 0,
    sells24h: refs[(meta[i * 2 + 1] as string).toLowerCase()]?.sells24h ?? 0,
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
    activity: activity && { trades: activity.trades, volume: activity.volume, traders: activity.traders, deposits: activity.deposits, since: DEPLOY_BLOCK, hourly: activity.hourly, daily: activity.daily },
  };
}

/** Swap + club deposit history since the venue deploy, via Envio HyperRPC. Null when no token is configured. */
async function readActivity(pools: readonly Address[], clubs: readonly Address[]) {
  if (indexerUrl()) {
    try {
      return await readActivityIndexed();
    } catch (e) {
      console.error("indexer stats failed, falling back to HyperRPC", e);
    }
  }
  const token = process.env.ENVIO_API_TOKEN;
  if (!token) return null;
  if (!pools.length) return { perPool: new Map<string, { trades: number; volume: number }>(), trades: 0, volume: 0, traders: 0, deposits: 0, ...buckets([]) };
  const hyper = hyperClient(token);
  const fromBlock = BigInt(DEPLOY_BLOCK);
  const [head, swaps, deposits] = await Promise.all([
    publicClient.getBlockNumber(), // the head from the regular RPC: one less HyperRPC call
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
  // Testnet blocks are ~0.4 s apart, so block distance from the head is a good clock here.
  const points = swaps.map((l) => ({ ago: Number(head - l.blockNumber!) * 0.4, usd: usdc(l.args.isBuy ? l.args.amountIn! : l.args.amountOut!) }));
  return { perPool, trades: swaps.length, volume, traders: traders.size, deposits: deposits.length, ...buckets(points) };
}

/** The same numbers from the Kadd indexer, with real timestamps. */
async function readActivityIndexed() {
  const [swaps, deposits] = await Promise.all([indexedSwaps(), indexedDepositors()]);
  const perPool = new Map<string, { trades: number; volume: number }>();
  const traders = new Set(deposits.map((d) => d.member));
  let volume = 0;
  for (const s of swaps) {
    const p = perPool.get(s.pool) ?? { trades: 0, volume: 0 };
    perPool.set(s.pool, { trades: p.trades + 1, volume: p.volume + s.usd });
    traders.add(s.trader);
    volume += s.usd;
  }
  const now = Date.now() / 1000;
  return { perPool, trades: swaps.length, volume, traders: traders.size, deposits: deposits.length, ...buckets(swaps.map((s) => ({ ago: now - s.timestamp, usd: s.usd }))) };
}

/** Hourly (24) and daily (7) buckets from each swap's age in seconds. */
function buckets(swaps: { ago: number; usd: number }[]) {
  const now = Math.floor(Date.now() / 1000);
  const make = (n: number, size: number) => {
    const out = { t: Array.from({ length: n }, (_, i) => now - (n - i) * size), trades: Array<number>(n).fill(0), volume: Array<number>(n).fill(0) };
    for (const s of swaps) {
      const ago = Math.floor(s.ago / size);
      if (ago < n) {
        out.trades[n - 1 - ago] += 1;
        out.volume[n - 1 - ago] += s.usd;
      }
    }
    return out;
  };
  return { hourly: make(24, 3600), daily: make(7, 86400) };
}
