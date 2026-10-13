// Live Monad *mainnet* market data, read-only (trading and clubs stay on testnet):
// - GeckoTerminal (no key, ~30 req/min): token lists, charts, trades, token info. Cached server-side.
// - DexScreener (no key, ~300 req/min): search and price quotes, which are per-user and can't share a cache.
import { age, type Candle, type Risk } from "./mock";
import { analyzeRisk, badgeOf, type RiskAnalysis } from "./risk";

// GeckoTerminal data. With COINGECKO_API_KEY (CoinGecko's free Demo plan works) the same endpoints go through
// CoinGecko's onchain API, rate-limited per key instead of per IP (shared cloud IPs get throttled by others' traffic).
const CG_KEY = process.env.COINGECKO_API_KEY;
const GT = CG_KEY ? "https://api.coingecko.com/api/v3/onchain" : "https://api.geckoterminal.com/api/v2";
const DS = "https://api.dexscreener.com";
const NET = "monad";

export const FRAMES = ["m5", "h1", "h6", "h24"] as const;
export type Frame = (typeof FRAMES)[number];
export const FRAME_LABEL: Record<Frame, string> = { m5: "5m", h1: "1h", h6: "6h", h24: "24h" };

export type TokenRef = { address: string; symbol: string; name: string; image: string | null };
export type MarketToken = TokenRef & {
  pool: string;
  dex: string;
  createdAt: number; // pool creation, ms
  price: number;
  mc: number;
  liq: number;
  change: Record<Frame, number>;
  vol: Record<Frame, number>;
  txns: Record<Frame, { buys: number; sells: number }>;
  risk: Risk;
};
export type Check = { label: string; value: string; ok: boolean | null }; // null = no data
export type TokenTrade = { ageSec: number; side: "buy" | "sell"; usd: number; amount: number; mc: number; trader: string; tx: string };
export type TokenDetail = MarketToken & {
  holders: number | null;
  score: number | null;
  description: string;
  links: { label: string; url: string }[];
  checks: Check[];
  analysis: RiskAnalysis;
  /** null = the chart / trades provider is rate-limiting right now; the page retries on its own. */
  candles: Candle[] | null;
  trades: TokenTrade[] | null;
};

// "Money" assets (stables, wrapped majors, MON liquid-staking tokens) aren't what a memecoin terminal lists, and a
// pool with one as its base describes the other side anyway, so lists skip them.
const MAJORS = new Set(["MON", "WMON", "SHMON", "SMON", "GMON", "APRMON", "LVMON", "EARNMON"]);
const isMoney = (t: TokenAttrs) =>
  MAJORS.has(t.symbol.toUpperCase()) || /USD|EUR|XAU|BTC|ETH/i.test(t.symbol) || /\b(wrapped|staked|stable)\b/i.test(t.name);

type Rel = { data: { id: string } | null };
type Pool = {
  attributes: {
    address: string;
    pool_created_at: string;
    base_token_price_usd: string;
    fdv_usd: string | null;
    market_cap_usd: string | null;
    reserve_in_usd: string | null;
    price_change_percentage: Record<string, string>;
    volume_usd: Record<string, string>;
    transactions: Record<string, { buys: number; sells: number }>;
  };
  relationships: { base_token: Rel; quote_token: Rel; dex: Rel };
};
type TokenAttrs = { address: string; name: string; symbol: string; image_url: string | null };
type Included = { id: string; type: string; attributes: TokenAttrs };

export class NotFound extends Error {}

// Last good response per URL: when a provider rate-limits (429) or hiccups, serve slightly stale data instead of an
// error page. ponytail: per-server-instance memory, unbounded by URL count; fine at hackathon traffic.
const lastGood = new Map<string, unknown>();
const fetchedAt = new Map<string, number>();
type Freshness = { stale: boolean; updatedAt: number | null };

// GeckoTerminal allows ~30 requests/minute per IP. Background readers (copy-trade feeds, sparklines) back off for a
// minute after any 429, so whatever budget is left goes to the page a user is looking at.
let backoffUntil = 0;

async function get<T>(url: string, revalidate: number, background = false, freshness?: Freshness): Promise<T> {
  if (background && Date.now() < backoffUntil) {
    if (lastGood.has(url)) {
      if (freshness) { freshness.stale = true; freshness.updatedAt = Math.min(freshness.updatedAt ?? Infinity, fetchedAt.get(url) ?? 0); }
      return lastGood.get(url) as T;
    }
    throw new Error("Market data unavailable (backing off after a rate limit)");
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (CG_KEY && url.startsWith(GT)) headers["x-cg-demo-api-key"] = CG_KEY;
  const res = await fetch(url, { headers, next: { revalidate }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (res?.status === 404) throw new NotFound(url);
  if (res?.status === 429) backoffUntil = Date.now() + 60_000;
  const json = res?.ok ? await res.json().catch(() => null) : null;
  if (!res?.ok || json === null) {
    if (lastGood.has(url)) {
      if (freshness) { freshness.stale = true; freshness.updatedAt = Math.min(freshness.updatedAt ?? Infinity, fetchedAt.get(url) ?? 0); }
      return lastGood.get(url) as T;
    }
    throw new Error(`Market data unavailable (${new URL(url).hostname} ${res?.status ?? "offline"})`);
  }
  const updated = Date.parse(res.headers.get("date") ?? "") || Date.now();
  fetchedAt.set(url, updated);
  if (freshness) freshness.updatedAt = Math.min(freshness.updatedAt ?? Infinity, updated);
  lastGood.set(url, json);
  return json;
}
const gt = <T,>(path: string, revalidate = 30, background = false, freshness?: Freshness) => get<T>(GT + path, revalidate, background, freshness);
const ds = <T,>(path: string, revalidate = 30) => get<T>(DS + path, revalidate);

const n = (v: string | number | null | undefined) => Number(v) || 0;
const image = (url: string | null | undefined) => (url && !url.includes("missing") ? url : null);
const frames = <T, U>(o: Record<string, T> | undefined, f: (v: T) => U, empty: U) =>
  Object.fromEntries(FRAMES.map((k) => [k, o?.[k] !== undefined ? f(o[k]) : empty])) as Record<Frame, U>;

/** Coarse risk from what every list row has: liquidity and pool age (detail pages refine it with GT's score). */
function riskOf(liq: number, createdAt: number, honeypot = false): Risk {
  if (honeypot || liq < 5_000) return "danger";
  if (liq < 50_000 || Date.now() - createdAt < 24 * 36e5) return "caution";
  return "safe";
}

function toToken(p: Pool, base: TokenAttrs): MarketToken {
  const a = p.attributes;
  const createdAt = Date.parse(a.pool_created_at);
  const liq = n(a.reserve_in_usd);
  return {
    address: base.address.toLowerCase(),
    symbol: base.symbol,
    name: base.name,
    image: image(base.image_url),
    pool: a.address,
    dex: p.relationships.dex.data?.id ?? "",
    createdAt,
    price: n(a.base_token_price_usd),
    mc: n(a.market_cap_usd) || n(a.fdv_usd),
    liq,
    change: frames(a.price_change_percentage, n, 0),
    vol: frames(a.volume_usd, n, 0),
    txns: frames(a.transactions, (t) => t, { buys: 0, sells: 0 }),
    risk: riskOf(liq, createdAt),
  };
}

async function poolList(path: string, revalidate = 30, freshness?: Freshness): Promise<MarketToken[]> {
  const j = await gt<{ data: Pool[]; included?: Included[] }>(`${path}${path.includes("?") ? "&" : "?"}include=base_token`, revalidate, false, freshness);
  const tokens = new Map((j.included ?? []).map((i) => [i.id, i.attributes]));
  const seen = new Set<string>();
  return j.data.flatMap((p) => {
    const base = tokens.get(p.relationships.base_token.data?.id ?? "");
    if (!base || isMoney(base) || seen.has(base.address)) return [];
    seen.add(base.address);
    return [toToken(p, base)];
  });
}

/** Two pages merged and de-duplicated: after skipping money assets one page can get thin. */
async function twoPages(path: string, freshness?: Freshness) {
  const pages = await Promise.all([1, 2].map((page) => poolList(`${path}${path.includes("?") ? "&" : "?"}page=${page}`, 30, freshness)));
  return pages.flat().filter((t, i, all) => all.findIndex((x) => x.address === t.address) === i);
}

/** For prerendered list pages: an empty list beats failing the build/revalidation when the provider rate-limits. */
export const orEmpty = (p: Promise<MarketToken[]>) => p.catch((): MarketToken[] => []);

export type MarketSnapshot = Freshness & { tokens: MarketToken[]; error: boolean };
/** Carry fallback status with each result, never in shared request-global state. */
export async function trenchesSnapshot(kind: "new" | "hot" | "top"): Promise<MarketSnapshot> {
  const freshness: Freshness = { stale: false, updatedAt: null };
  try {
    const tokens = kind === "new"
      ? await poolList(`/networks/${NET}/new_pools`, 30, freshness)
      : await twoPages(kind === "hot" ? `/networks/${NET}/trending_pools?duration=1h` : `/networks/${NET}/pools?sort=h24_volume_usd_desc`, freshness);
    return { tokens, ...freshness, stale: freshness.stale || (freshness.updatedAt !== null && Date.now() - freshness.updatedAt > 90_000), error: false };
  } catch {
    return { tokens: [], stale: false, updatedAt: null, error: true };
  }
}

export const newPairs = () => poolList(`/networks/${NET}/new_pools`);
export const hot = () => twoPages(`/networks/${NET}/trending_pools?duration=1h`);
export const topVolume = () => twoPages(`/networks/${NET}/pools?sort=h24_volume_usd_desc`);
export const trending = () => twoPages(`/networks/${NET}/trending_pools?duration=24h`);
type Pair = {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  txns?: Record<string, { buys: number; sells: number }>;
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: { label?: string; url: string }[]; socials?: { type: string; url: string }[] };
};

/** Monad pairs → one token each (its most liquid pair), skipping money assets unless `all`. */
function fromPairs(pairs: Pair[], all = false): MarketToken[] {
  const best = new Map<string, Pair>();
  for (const p of pairs) {
    const addr = p.baseToken.address.toLowerCase();
    if (p.chainId !== NET || (!all && isMoney({ ...p.baseToken, image_url: null }))) continue;
    if ((best.get(addr)?.liquidity?.usd ?? -1) < (p.liquidity?.usd ?? 0)) best.set(addr, p);
  }
  return [...best.values()].map((p) => {
    const liq = p.liquidity?.usd ?? 0;
    const createdAt = p.pairCreatedAt ?? Date.now();
    return {
      address: p.baseToken.address.toLowerCase(),
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      image: p.info?.imageUrl ?? null,
      pool: p.pairAddress.toLowerCase(),
      dex: p.dexId,
      createdAt,
      price: n(p.priceUsd),
      mc: p.marketCap || p.fdv || 0,
      liq,
      change: frames(p.priceChange, n, 0),
      vol: frames(p.volume, n, 0),
      txns: frames(p.txns, (t) => t, { buys: 0, sells: 0 }),
      risk: riskOf(liq, createdAt),
    };
  });
}

/** Name, symbol or contract address. Most liquid first. */
export async function searchTokens(q: string) {
  const { pairs } = await ds<{ pairs: Pair[] | null }>(`/latest/dex/search?q=${encodeURIComponent(q)}`, 60);
  return fromPairs(pairs ?? []).sort((a, b) => b.liq - a.liq);
}

export type Quote = { price: number; mc: number; change24h: number; symbol: string; image: string | null; pool: string; buys24h: number; sells24h: number };
/** Price, market cap and 24h change for up to 30 tokens in one call. */
export async function quotes(addresses: string[]): Promise<Record<string, Quote>> {
  const list = [...new Set(addresses.map((a) => a.toLowerCase()).filter(isAddress))].slice(0, 30);
  if (!list.length) return {};
  const tokens = fromPairs(await ds<Pair[]>(`/tokens/v1/${NET}/${list.join(",")}`));
  return Object.fromEntries(
    tokens.map((t) => [t.address, { price: t.price, mc: t.mc, change24h: t.change.h24, symbol: t.symbol, image: t.image, pool: t.pool, buys24h: t.txns.h24.buys, sells24h: t.txns.h24.sells }]),
  );
}

/** Last 24 hourly closes (USD) of a mainnet pool, oldest first. Cached 10 min: it only feeds small sparklines. */
export async function hourlyCloses(pool: string, token: string): Promise<{ t: number; v: number }[]> {
  const j = await gt<{ data: { attributes: { ohlcv_list: number[][] } } }>(`/networks/${NET}/pools/${pool}/ohlcv/hour?aggregate=1&limit=24&token=${token}`, 600, true);
  return toCandles(j.data.attributes.ohlcv_list, 1).map((c) => ({ t: c.time, v: c.close }));
}

export const isAddress = (s: string) => /^0x[0-9a-f]{40}$/i.test(s);
export const dexName = (id: string) => id.replace(/-monad$/, "").replace(/-/g, " ");
export const ageOf = (createdAt: number) => age(Math.max(0, Math.round((Date.now() - createdAt) / 60000)));

type Info = {
  description: string | null;
  websites: string[] | null;
  twitter_handle: string | null;
  telegram_handle: string | null;
  discord_url: string | null;
  gt_score: number | null;
  gt_verified: boolean | null;
  holders: { count: number | null } | null;
  is_honeypot: boolean | null;
};

/** The token's main pool and stats: DexScreener first (generous rate limit), GeckoTerminal if it doesn't know it. */
async function tokenCore(addr: string): Promise<{ base: MarketToken; isBase: boolean; extraLinks: { label: string; url: string }[] } | null> {
  const pairs = await ds<Pair[]>(`/tokens/v1/${NET}/${addr}`).catch(() => null);
  const fromDs = pairs ? fromPairs(pairs, true).find((t) => t.address === addr) : undefined;
  if (fromDs) {
    const info = pairs!.find((p) => p.pairAddress.toLowerCase() === fromDs.pool)?.info;
    const extraLinks = [
      ...(info?.websites ?? []).slice(0, 1).map((w) => ({ label: "Website", url: w.url })),
      ...(info?.socials ?? []).map((x) => ({ label: x.type === "twitter" ? "X" : x.type[0].toUpperCase() + x.type.slice(1), url: x.url })),
    ];
    return { base: fromDs, isBase: true, extraLinks };
  }

  const id = `${NET}_${addr}`;
  let tok: { data: { attributes: TokenAttrs & { price_usd: string; market_cap_usd: string | null; fdv_usd: string | null } }; included?: Pool[] };
  try {
    tok = await gt(`/networks/${NET}/tokens/${addr}?include=top_pools`);
  } catch (e) {
    if (e instanceof NotFound) return null;
    throw e;
  }
  const pools = tok.included ?? [];
  const top = pools.find((p) => p.relationships.base_token.data?.id === id) ?? pools[0];
  if (!top) return null;
  const t = tok.data.attributes;
  const base = toToken(top, t);
  return {
    base: { ...base, price: n(t.price_usd) || base.price, mc: n(t.market_cap_usd) || n(t.fdv_usd) || base.mc },
    isBase: top.relationships.base_token.data?.id === id,
    extraLinks: [],
  };
}

/** Everything the token page needs. Returns null when no provider knows the token or it has no pool. Chart, trades
 * and info are best-effort: if GeckoTerminal rate-limits, those parts come back empty and the page still renders. */
export async function tokenDetail(address: string): Promise<TokenDetail | null> {
  const addr = address.toLowerCase();
  if (!isAddress(addr)) return null;
  const core = await tokenCore(addr);
  if (!core) return null;
  const { base, isBase, extraLinks } = core;
  const pool = base.pool;

  const [info, ohlcv, trades] = await Promise.all([
    gt<{ data: { attributes: Info } }>(`/networks/${NET}/tokens/${addr}/info`, 600).then((j) => j.data.attributes, () => null),
    // The chart loads separately (/api/chart). Candles are only needed here when the token is the pool's quote side,
    // to derive its % changes; otherwise skip the call so the page doesn't wait on it.
    isBase
      ? Promise.resolve(null)
      : gt<{ data: { attributes: { ohlcv_list: number[][] } } }>(`/networks/${NET}/pools/${pool}/ohlcv/minute?aggregate=5&limit=288&token=${addr}`, 60).then(
          (j) => j.data.attributes.ohlcv_list,
          () => null,
        ),
    gt<{ data: { attributes: Record<string, string> }[] }>(`/networks/${NET}/pools/${pool}/trades`, 30).then((j) => j.data, () => null),
  ]);

  const supply = base.price ? base.mc / base.price : 0;
  // Candles in market cap (what memecoin traders read), oldest first.
  const candles: Candle[] | null = ohlcv ? toCandles(ohlcv, supply) : null;
  // Pool stats describe the pool's base token; when our token is the quote side, derive change from the candles.
  const change = isBase || !candles ? base.change : frames({ m5: 300, h1: 3600, h6: 21600, h24: 86400 }, (sec) => changeOver(candles, sec), 0);
  const txns = isBase ? base.txns : frames(base.txns, (t) => ({ buys: t.sells, sells: t.buys }), { buys: 0, sells: 0 });

  const now = Date.now();
  const tradeRows: TokenTrade[] | null =
    trades?.slice(0, 50).map(({ attributes: t }) => {
      const buy = t.to_token_address?.toLowerCase() === addr;
      return {
        ageSec: Math.max(0, Math.round((now - Date.parse(t.block_timestamp)) / 1000)),
        side: buy ? "buy" : "sell",
        usd: n(t.volume_in_usd),
        amount: n(buy ? t.to_token_amount : t.from_token_amount),
        mc: n(buy ? t.price_to_in_usd : t.price_from_in_usd) * supply,
        trader: t.tx_from_address,
        tx: t.tx_hash,
      };
    }) ?? null;

  const holders = info?.holders?.count ?? null;
  const score = info?.gt_score ?? null;
  const ageH = (now - base.createdAt) / 36e5;
  const checks: Check[] = [
    { label: "Not a honeypot", value: info?.is_honeypot == null ? "Unknown" : info.is_honeypot ? "Honeypot" : "Sellable", ok: info?.is_honeypot == null ? null : !info.is_honeypot },
    { label: "GeckoTerminal score", value: score == null ? "–" : `${Math.round(score)}/100`, ok: score == null ? null : score >= 50 },
    { label: "Liquidity", value: `$${Math.round(base.liq).toLocaleString("en-US")}`, ok: base.liq >= 10_000 },
    { label: "Pool age", value: ageH < 48 ? `${Math.round(ageH)}h` : `${Math.round(ageH / 24)}d`, ok: ageH >= 24 },
    { label: "Holders", value: holders == null ? "–" : holders.toLocaleString("en-US"), ok: holders == null ? null : holders >= 500 },
    { label: "Verified info", value: info?.gt_verified ? "Yes" : info ? "No" : "–", ok: info ? !!info.gt_verified : null },
  ];
  const analysis = analyzeRisk({
    symbol: base.symbol,
    liq: base.liq,
    mc: base.mc,
    createdAt: base.createdAt,
    change,
    vol: base.vol,
    txns,
    holders,
    score,
    honeypot: info?.is_honeypot ?? null,
    verified: info ? !!info.gt_verified : null,
    trades: tradeRows,
  });
  const risk: Risk = badgeOf(analysis.level);

  const links = info
    ? [
        ...(info.websites ?? []).slice(0, 1).map((url) => ({ label: "Website", url })),
        ...(info.twitter_handle ? [{ label: "X", url: `https://x.com/${info.twitter_handle}` }] : []),
        ...(info.telegram_handle ? [{ label: "Telegram", url: `https://t.me/${info.telegram_handle}` }] : []),
        ...(info.discord_url ? [{ label: "Discord", url: info.discord_url }] : []),
      ]
    : extraLinks;
  links.push({ label: "GeckoTerminal", url: `https://www.geckoterminal.com/${NET}/pools/${pool}` });

  return { ...base, change, txns, risk, holders, score, description: info?.description ?? "", links, checks, analysis, candles, trades: tradeRows };
}

/** GeckoTerminal sometimes repeats a timestamp; the chart needs strictly increasing times, so merge duplicates. */
export function toCandles(ohlcv: number[][], scale: number): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const [time, o, h, l, c, v] of [...ohlcv].sort((a, b) => a[0] - b[0])) {
    const prev = byTime.get(time);
    byTime.set(
      time,
      prev
        ? { ...prev, high: Math.max(prev.high, h * scale), low: Math.min(prev.low, l * scale), close: c * scale, value: prev.value + v }
        : { time, open: o * scale, high: h * scale, low: l * scale, close: c * scale, value: v },
    );
  }
  return [...byTime.values()];
}

function changeOver(candles: Candle[], sec: number) {
  const last = candles.at(-1);
  if (!last) return 0;
  const from = candles.find((c) => c.time >= last.time - sec) ?? candles[0];
  return from.open ? ((last.close - from.open) / from.open) * 100 : 0;
}

export type PoolTrade = { at: number; side: "buy" | "sell"; usd: number; amount: number; price: number; trader: string; tx: string };

/** A mainnet pool's latest trades (GeckoTerminal returns the last 300), from `token`'s side. Newest first. */
export async function poolTrades(pool: string, token: string): Promise<PoolTrade[]> {
  const j = await gt<{ data: { attributes: Record<string, string> }[] }>(`/networks/${NET}/pools/${pool}/trades`, 120, true);
  return j.data.map(({ attributes: t }) => {
    const buy = t.to_token_address?.toLowerCase() === token;
    return {
      at: Date.parse(t.block_timestamp),
      side: buy ? "buy" : "sell",
      usd: n(t.volume_in_usd),
      amount: n(buy ? t.to_token_amount : t.from_token_amount),
      price: n(buy ? t.price_to_in_usd : t.price_from_in_usd),
      trader: t.tx_from_address.toLowerCase(),
      tx: t.tx_hash,
    };
  });
}

// ---------------------------------------------------------------- charts

/** Chart timeframes: GeckoTerminal's OHLCV period + aggregate, candle length, and how long a response stays fresh. */
export const TIMEFRAMES = {
  "1m": { period: "minute", aggregate: 1, sec: 60, ttl: 20 },
  "5m": { period: "minute", aggregate: 5, sec: 300, ttl: 30 },
  "15m": { period: "minute", aggregate: 15, sec: 900, ttl: 60 },
  "1h": { period: "hour", aggregate: 1, sec: 3600, ttl: 120 },
  "4h": { period: "hour", aggregate: 4, sec: 14400, ttl: 300 },
  "1d": { period: "day", aggregate: 1, sec: 86400, ttl: 600 },
} as const;
export type Timeframe = keyof typeof TIMEFRAMES;
const MAX_CANDLES = 300;

/**
 * GeckoTerminal only returns candles for intervals that had trades, so a quiet token's chart would glue candles
 * hours apart side by side. Fill every missing interval with a flat candle at the last close (zero volume), the way
 * trading terminals do, so the time axis is honest. Keeps the newest `max` candles.
 */
export function fillGaps(candles: Candle[], step: number, until: number, max = MAX_CANDLES): Candle[] {
  if (!candles.length) return [];
  const out: Candle[] = [];
  const end = Math.floor(until / step) * step;
  let i = 0;
  let last = candles[0];
  for (let t = candles[0].time; t <= end; t += step) {
    if (i < candles.length && candles[i].time === t) out.push((last = candles[i++]));
    else if (i < candles.length && candles[i].time < t) {
      // Off-grid timestamp (shouldn't happen): take it and continue from it.
      out.push((last = candles[i++]));
      t = last.time;
    } else out.push({ time: t, open: last.close, high: last.close, low: last.close, close: last.close, value: 0 });
  }
  return out.slice(-max);
}

/** USD price candles for `token` in `pool`, gap-filled, oldest first. `trades` = candles in view that had trades. */
export async function ohlcv(pool: string, token: string, tf: Timeframe) {
  const f = TIMEFRAMES[tf];
  const j = await gt<{ data: { attributes: { ohlcv_list: number[][] } } }>(
    `/networks/${NET}/pools/${pool}/ohlcv/${f.period}?aggregate=${f.aggregate}&limit=${MAX_CANDLES}&token=${token}&currency=usd`,
    f.ttl,
  );
  const candles = fillGaps(toCandles(j.data.attributes.ohlcv_list, 1), f.sec, Date.now() / 1000);
  return { tf, candles, trades: candles.filter((c) => c.value > 0).length };
}

const MON_USDC_POOL = "0x659bd0bc4167ba25c62e05656f78043e7ed4a9da"; // Uniswap V3, the deepest MON/USDC pool
const WMON = "0x3bd359c1119da7da1d913d1c4d2b7c461115433a";

/**
 * Hourly MON/USD closes (oldest first), to value MON-quoted swaps in dollars at the time they happened. One small
 * cached call per 30 min; if it's unavailable, falls back to today's MON price as a single point.
 */
export async function monUsdCandles(): Promise<{ time: number; close: number }[]> {
  try {
    const j = await gt<{ data: { attributes: { ohlcv_list: number[][] } } }>(`/networks/${NET}/pools/${MON_USDC_POOL}/ohlcv/hour?aggregate=1&limit=1000&token=${WMON}`, 1800, true);
    const hours = toCandles(j.data.attributes.ohlcv_list, 1).map((c) => ({ time: c.time, close: c.close }));
    if (hours.length) return hours;
  } catch {}
  // Lists filter out MON itself, so read the MON/USDC pair directly.
  const pair = await ds<{ pairs: { priceUsd: string }[] | null }>(`/latest/dex/pairs/${NET}/${MON_USDC_POOL}`, 60).catch(() => null);
  const price = Number(pair?.pairs?.[0]?.priceUsd);
  return price > 0 ? [{ time: 0, close: price }] : [];
}
