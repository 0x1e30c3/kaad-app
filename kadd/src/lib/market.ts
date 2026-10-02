// Live Monad *mainnet* market data, read-only (trading and clubs stay on testnet):
// - GeckoTerminal (no key, ~30 req/min): token lists, charts, trades, token info. Cached server-side.
// - DexScreener (no key, ~300 req/min): search and price quotes, which are per-user and can't share a cache.
import { age, type Candle, type Risk } from "./mock";

const GT = "https://api.geckoterminal.com/api/v2";
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
  candles: Candle[];
  trades: TokenTrade[];
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

async function get<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate } }).catch(() => null);
  if (res?.status === 404) throw new NotFound(url);
  if (!res?.ok) {
    if (lastGood.has(url)) return lastGood.get(url) as T;
    throw new Error(`Market data unavailable (${new URL(url).hostname} ${res?.status ?? "offline"})`);
  }
  const json = await res.json();
  lastGood.set(url, json);
  return json;
}
const gt = <T,>(path: string, revalidate = 30) => get<T>(GT + path, revalidate);
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

async function poolList(path: string, revalidate = 30): Promise<MarketToken[]> {
  const j = await gt<{ data: Pool[]; included?: Included[] }>(`${path}${path.includes("?") ? "&" : "?"}include=base_token`, revalidate);
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
async function twoPages(path: string) {
  const pages = await Promise.all([1, 2].map((page) => poolList(`${path}${path.includes("?") ? "&" : "?"}page=${page}`)));
  return pages.flat().filter((t, i, all) => all.findIndex((x) => x.address === t.address) === i);
}

/** For prerendered list pages: an empty list beats failing the build/revalidation when the provider rate-limits. */
export const orEmpty = (p: Promise<MarketToken[]>) => p.catch((): MarketToken[] => []);

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
  info?: { imageUrl?: string };
};

/** Monad pairs → one token each (its most liquid pair), skipping money assets. */
function fromPairs(pairs: Pair[]): MarketToken[] {
  const best = new Map<string, Pair>();
  for (const p of pairs) {
    const addr = p.baseToken.address.toLowerCase();
    if (p.chainId !== NET || isMoney({ ...p.baseToken, image_url: null })) continue;
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

export type Quote = { price: number; mc: number; change24h: number };
/** Price, market cap and 24h change for up to 30 tokens in one call. */
export async function quotes(addresses: string[]): Promise<Record<string, Quote>> {
  const list = [...new Set(addresses.map((a) => a.toLowerCase()).filter(isAddress))].slice(0, 30);
  if (!list.length) return {};
  const tokens = fromPairs(await ds<Pair[]>(`/tokens/v1/${NET}/${list.join(",")}`));
  return Object.fromEntries(tokens.map((t) => [t.address, { price: t.price, mc: t.mc, change24h: t.change.h24 }]));
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

/** Everything the token page needs. Returns null when GeckoTerminal doesn't know the token or it has no pool. */
export async function tokenDetail(address: string): Promise<TokenDetail | null> {
  const addr = address.toLowerCase();
  if (!isAddress(addr)) return null;
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
  const isBase = top.relationships.base_token.data?.id === id;
  const pool = top.attributes.address;

  const [info, ohlcv, trades] = await Promise.all([
    gt<{ data: { attributes: Info } }>(`/networks/${NET}/tokens/${addr}/info`, 600).then((j) => j.data.attributes, () => null),
    gt<{ data: { attributes: { ohlcv_list: number[][] } } }>(`/networks/${NET}/pools/${pool}/ohlcv/minute?aggregate=5&limit=288&token=${addr}`, 60),
    gt<{ data: { attributes: Record<string, string> }[] }>(`/networks/${NET}/pools/${pool}/trades`, 15),
  ]);

  const base = toToken(top, tok.data.attributes);
  const price = n(tok.data.attributes.price_usd) || base.price;
  const mc = n(tok.data.attributes.market_cap_usd) || n(tok.data.attributes.fdv_usd) || base.mc;
  const supply = price ? mc / price : 0;

  // Candles in market cap (what memecoin traders read), oldest first.
  const candles: Candle[] = ohlcv.data.attributes.ohlcv_list
    .map(([time, o, h, l, c, v]) => ({ time, open: o * supply, high: h * supply, low: l * supply, close: c * supply, value: v }))
    .reverse();
  // Pool stats describe the pool's base token; when our token is the quote side, derive change from the candles.
  const change = isBase ? base.change : frames({ m5: 300, h1: 3600, h6: 21600, h24: 86400 }, (sec) => changeOver(candles, sec), 0);
  const txns = isBase ? base.txns : frames(base.txns, (t) => ({ buys: t.sells, sells: t.buys }), { buys: 0, sells: 0 });

  const now = Date.now();
  const tradeRows: TokenTrade[] = trades.data.slice(0, 50).map(({ attributes: t }) => {
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
  });

  const holders = info?.holders?.count ?? null;
  const score = info?.gt_score ?? null;
  const ageH = (now - base.createdAt) / 36e5;
  const checks: Check[] = [
    { label: "Not a honeypot", value: info?.is_honeypot == null ? "Unknown" : info.is_honeypot ? "Honeypot" : "Sellable", ok: info?.is_honeypot == null ? null : !info.is_honeypot },
    { label: "GeckoTerminal score", value: score == null ? "–" : `${Math.round(score)}/100`, ok: score == null ? null : score >= 50 },
    { label: "Liquidity", value: `$${Math.round(base.liq).toLocaleString("en-US")}`, ok: base.liq >= 10_000 },
    { label: "Pool age", value: ageH < 48 ? `${Math.round(ageH)}h` : `${Math.round(ageH / 24)}d`, ok: ageH >= 24 },
    { label: "Holders", value: holders == null ? "–" : holders.toLocaleString("en-US"), ok: holders == null ? null : holders >= 500 },
    { label: "Verified info", value: info?.gt_verified ? "Yes" : "No", ok: info ? !!info.gt_verified : null },
  ];
  const risk: Risk =
    info?.is_honeypot || base.liq < 5_000 || (score != null && score < 35) ? "danger" : checks.some((c) => c.ok === false) ? "caution" : "safe";

  const links = [
    ...(info?.websites ?? []).slice(0, 1).map((url) => ({ label: "Website", url })),
    ...(info?.twitter_handle ? [{ label: "X", url: `https://x.com/${info.twitter_handle}` }] : []),
    ...(info?.telegram_handle ? [{ label: "Telegram", url: `https://t.me/${info.telegram_handle}` }] : []),
    ...(info?.discord_url ? [{ label: "Discord", url: info.discord_url }] : []),
    { label: "GeckoTerminal", url: `https://www.geckoterminal.com/${NET}/pools/${pool}` },
  ];

  return { ...base, price, mc, change, txns, risk, holders, score, description: info?.description ?? "", links, checks, candles, trades: tradeRows };
}

function changeOver(candles: Candle[], sec: number) {
  const last = candles.at(-1);
  if (!last) return 0;
  const from = candles.find((c) => c.time >= last.time - sec) ?? candles[0];
  return from.open ? ((last.close - from.open) / from.open) * 100 : 0;
}
