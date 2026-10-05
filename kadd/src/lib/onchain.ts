// Price candles built straight from Monad mainnet swap events (Envio HyperRPC): the fallback for short timeframes
// when the market-data API is rate-limiting. Handles Uniswap-V3-style pools
// (Uniswap, nad.fun after graduation, PancakeSwap V3) and V2-style pools; anything else returns null and the caller
// falls back to GeckoTerminal. Candles are in USD: the pool's quote token is valued at a stablecoin's $1, or at the
// MON/USD price of that hour.
import "server-only";
import { createPublicClient, decodeAbiParameters, erc20Abi, http, type Address, type Hex } from "viem";
import { monad } from "viem/chains";
import type { Candle } from "./mock";
import { swr } from "./cache";
import { TIMEFRAMES, fillGaps, monUsdCandles, type Timeframe } from "./market";

const WMON = "0x3bd359c1119da7da1d913d1c4d2b7c461115433a";
const STABLES = new Set([
  "0x754704bc059f8c67012fed69bc8a327a5aafb603", // USDC
  "0x00000000efe302beaa2b3e6e1b18d08d69a9012a", // AUSD
  "0xe7cd86e13ac4309349f30b3435a9d337750fc82d", // USDT0
]);
const V3 = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"; // Uniswap V3 Swap
const PCS3 = "0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83"; // PancakeSwap V3 Swap
const V2 = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"; // Uniswap V2 Swap
const CHUNK = 250_000n; // blocks per getLogs (~21 h); bigger ranges time out
const SEC_PER_BLOCK = 0.3; // Monad mainnet (measured); only used to pick a starting block, timestamps come from logs

const rpc = () => {
  const token = process.env.ENVIO_API_TOKEN;
  return token ? createPublicClient({ chain: monad, transport: http(`https://monad.rpc.hypersync.xyz/${token}`, { retryCount: 3, retryDelay: 500 }) }) : null;
};
const mainnet = createPublicClient({ chain: monad, transport: http(), batch: { multicall: true } });

type Meta = { token0: string; token1: string; dec0: number; dec1: number };
type Swap = { t: number; block: bigint; price: number; quoteAmount: number }; // price = token in quote; quoteAmount = |quote side|
type Store = { from: bigint; to: bigint; swaps: Swap[] };
const g = globalThis as { __kaddSwaps?: Map<string, Store> };
const stores = (g.__kaddSwaps ??= new Map<string, Store>());

const poolMeta = (pool: string) =>
  swr(`poolmeta:${pool}`, 24 * 3600_000, async (): Promise<Meta | null> => {
    const abi = [
      { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
      { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
    ] as const;
    const [t0, t1] = await Promise.all([
      mainnet.readContract({ address: pool as Address, abi, functionName: "token0" }).catch(() => null),
      mainnet.readContract({ address: pool as Address, abi, functionName: "token1" }).catch(() => null),
    ]);
    if (!t0 || !t1) return null;
    const [dec0, dec1] = await Promise.all([t0, t1].map((a) => mainnet.readContract({ address: a, abi: erc20Abi, functionName: "decimals" })));
    return { token0: t0.toLowerCase(), token1: t1.toLowerCase(), dec0, dec1 };
  });

/** Decodes one swap log into the token's price in the quote token and the quote amount traded. */
export function decodeSwap(topic0: string, data: Hex, meta: Meta, tokenIs0: boolean): { price: number; quoteAmount: number } | null {
  const scale = 10 ** (meta.dec0 - meta.dec1);
  if (topic0 === V3 || topic0 === PCS3) {
    const [a0, a1, sqrtP] = decodeAbiParameters([{ type: "int256" }, { type: "int256" }, { type: "uint160" }], data);
    const r = Number(sqrtP) / 2 ** 96;
    const p1per0 = r * r * scale; // token1 per token0, in whole units
    if (!(p1per0 > 0)) return null;
    const quoteRaw = tokenIs0 ? a1 : a0;
    const quoteDec = tokenIs0 ? meta.dec1 : meta.dec0;
    return { price: tokenIs0 ? p1per0 : 1 / p1per0, quoteAmount: Math.abs(Number(quoteRaw)) / 10 ** quoteDec };
  }
  if (topic0 === V2) {
    const [in0, in1, out0, out1] = decodeAbiParameters([{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }], data);
    const d0 = Number(in0 > 0n ? in0 : out0) / 10 ** meta.dec0;
    const d1 = Number(in1 > 0n ? in1 : out1) / 10 ** meta.dec1;
    if (!(d0 > 0 && d1 > 0)) return null;
    return { price: tokenIs0 ? d1 / d0 : d0 / d1, quoteAmount: tokenIs0 ? d1 : d0 };
  }
  return null;
}

/** Swaps of `pool` since `fromTime` (unix s), from an in-memory store that only ever fetches blocks it hasn't seen. */
async function swapsSince(pool: string, meta: Meta, token: string, fromTime: number): Promise<Swap[] | null> {
  const client = rpc();
  if (!client) return null;
  return swr(`swaps:${pool}:${token}:${fromTime >> 6}`, 10_000, async () => {
    const head = await mainnet.getBlockNumber(); // public RPC: HyperRPC's free quota is ~5 requests/minute
    const wantFrom = head - BigInt(Math.ceil(((Date.now() / 1000 - fromTime) / SEC_PER_BLOCK) * 1.1));
    const tokenIs0 = meta.token0 === token;
    const fetchRange = async (from: bigint, to: bigint): Promise<Swap[]> => {
      if (from > to) return [];
      // Larger ranges time out (~10 s): split into ~1-day chunks.
      if (to - from > CHUNK) return [...(await fetchRange(from, from + CHUNK - 1n)), ...(await fetchRange(from + CHUNK, to))];
      const logs = await client.request({
        method: "eth_getLogs",
        params: [{ address: pool as Address, topics: [[V3, PCS3, V2]], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }],
      }) as { topics: Hex[]; data: Hex; blockNumber: Hex; blockTimestamp?: Hex }[];
      return logs.flatMap((l) => {
        const d = decodeSwap(l.topics[0], l.data, meta, tokenIs0);
        return d && l.blockTimestamp ? [{ t: Number(BigInt(l.blockTimestamp)), block: BigInt(l.blockNumber), ...d }] : [];
      });
    };
    const key = `${pool}:${token}`;
    let s = stores.get(key);
    if (!s) {
      s = { from: wantFrom, to: head, swaps: await fetchRange(wantFrom, head) };
    } else {
      const older = wantFrom < s.from ? await fetchRange(wantFrom, s.from - 1n) : [];
      const newer = await fetchRange(s.to + 1n, head);
      s = { from: wantFrom < s.from ? wantFrom : s.from, to: head, swaps: [...older, ...s.swaps, ...newer] };
    }
    stores.set(key, s);
    return s.swaps.filter((x) => x.t >= fromTime);
  });
}

/** USD value of 1 quote token at time t: $1 for stables, MON/USD of that hour for WMON. Null = unsupported quote. */
async function quoteUsd(quote: string): Promise<((t: number) => number) | null> {
  if (STABLES.has(quote)) return () => 1;
  if (quote !== WMON) return null;
  const hours = await monUsdCandles();
  if (!hours.length) return null;
  return (t: number) => {
    // Last hourly close at or before t (hours are sorted ascending).
    let lo = 0, hi = hours.length - 1, best = hours[0].close;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (hours[mid].time <= t) {
        best = hours[mid].close;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best;
  };
}

/** Buckets swaps into OHLC candles of `step` seconds (USD), oldest first. */
export function bucket(swaps: { t: number; price: number; quoteAmount: number }[], step: number, usd: (t: number) => number): Candle[] {
  const out: Candle[] = [];
  for (const s of [...swaps].sort((a, b) => a.t - b.t)) {
    const time = Math.floor(s.t / step) * step;
    const p = s.price * usd(s.t);
    const v = s.quoteAmount * usd(s.t);
    const last = out.at(-1);
    if (last && last.time === time) {
      last.high = Math.max(last.high, p);
      last.low = Math.min(last.low, p);
      last.close = p;
      last.value += v;
    } else out.push({ time, open: last ? last.close : p, high: Math.max(p, last?.close ?? p), low: Math.min(p, last?.close ?? p), close: p, value: v });
  }
  return out;
}

/** Gap-filled USD candles from chain data, or null when this pool / quote isn't supported here. */
export const CHAIN_TIMEFRAMES = new Set<Timeframe>(["1m", "5m"]);

export async function chainOhlcv(pool: string, token: string, tf: Timeframe) {
  // Only short windows (≤ ~1 day of swaps): HyperRPC's free quota is ~5 requests/minute, so longer history comes from
  // the market-data API. Uniswap V4 pool ids etc. aren't decoded here.
  if (!/^0x[0-9a-f]{40}$/i.test(pool) || !CHAIN_TIMEFRAMES.has(tf)) return null;
  const meta = await poolMeta(pool.toLowerCase()).catch(() => null);
  const t = token.toLowerCase();
  if (!meta || (meta.token0 !== t && meta.token1 !== t)) return null;
  const usd = await quoteUsd(meta.token0 === t ? meta.token1 : meta.token0);
  if (!usd) return null;
  const f = TIMEFRAMES[tf];
  const now = Date.now() / 1000;
  const swaps = await swapsSince(pool.toLowerCase(), meta, t, now - f.sec * 300);
  if (!swaps) return null;
  const candles = fillGaps(bucket(swaps, f.sec, usd), f.sec, now);
  return { tf, candles, trades: candles.filter((c) => c.value > 0).length, source: "chain" as const };
}
