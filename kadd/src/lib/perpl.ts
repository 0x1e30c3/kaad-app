// Perpl (perpetual futures on Monad): every open position on mainnet, read straight from the Exchange contract.
// getPositionsV2 pages through each market's position list with unrealized PnL, so live "who holds what" needs no
// indexer. The Kadd indexer (indexer/, Perpl on chain 143) adds deposits / withdrawals and liquidations per account,
// which turn live equity into all-time PnL (equity − net deposits).
import "server-only";
import { createPublicClient, erc20Abi, http, parseAbi, type Address } from "viem";
import { monad, monadTestnet } from "viem/chains";
import { swr } from "./cache";
import type { PerpTerms } from "./perplOrder";
import { indexedPerplAccounts, indexedPerplDaily, indexedPerplLiquidations, indexerUrl, type IndexedPerplAccount, type IndexedPerplDaily, type IndexedPerplLiquidation } from "./indexer";
import { liqDistance, liquidationMap, type LiqBucket } from "./perplRisk";

const CNS = 1e6; // AUSD collateral, 6 decimals

/** Perpl runs on both Monad networks: leaders are read on mainnet, Kadd's copy bot trades on testnet. */
export const PERPL = {
  mainnet: {
    chainId: 143,
    api: "https://app.perpl.xyz/api",
    exchange: "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F" as Address,
    client: createPublicClient({ chain: monad, transport: http(process.env.MAINNET_RPC_URL || undefined), batch: { multicall: true } }),
  },
  testnet: {
    chainId: 10143,
    api: "https://testnet.perpl.xyz/api",
    exchange: "0x1964c32f0be608e7d29302aff5e61268e72080cc" as Address,
    client: createPublicClient({ chain: monadTestnet, transport: http(process.env.NEXT_PUBLIC_RPC_URL || undefined), batch: { multicall: true } }),
  },
} as const;
export type Net = keyof typeof PERPL;

export const perplAbi = parseAbi([
  "struct PositionInfo { uint256 accountId; uint256 nextNodeId; uint256 prevNodeId; uint8 positionType; uint256 depositCNS; uint256 pricePNS; uint256 lotLNS; uint256 entryBlock; int256 pnlCNS; int256 deltaPnlCNS; int256 premiumPnlCNS; uint256 priceResiduePNSQ16; }",
  "struct PositionBitMap { uint256 bank1; uint256 bank2; uint256 bank3; uint256 bank4; }",
  "struct AccountInfo { uint256 accountId; uint256 balanceCNS; uint256 lockedBalanceCNS; uint8 frozen; address accountAddr; PositionBitMap positions; }",
  "function getPositionIds(uint256 perpId) view returns (uint256 startNodeId, uint256 endNodeId)",
  "function getPositionsV2(uint256 perpId, uint256 pageStartPositionId, uint256 positionsPerPage) view returns (PositionInfo[] positions, uint256 numPositions, uint256 markPricePNS, bool markPriceValid)",
  "function getAccountById(uint256 accountId) view returns (AccountInfo accountInfo)",
  "function getAccountByAddr(address accountAddress) view returns (AccountInfo accountInfo)",
]);

export type PerpMarket = PerpTerms & { open: boolean };
export type PerpPosition = {
  marketId: number;
  market: string;
  account: number;
  address: string;
  side: "long" | "short";
  size: number; // in the market's units (BTC, ETH, …)
  entry: number;
  mark: number;
  notional: number; // size × mark, USD
  deposit: number; // margin, USD
  leverage: number; // notional / margin
  pnl: number; // unrealized, incl. funding, USD
  liquidation: number; // approximate liquidation price (Perpl SDK formula, before accrued funding)
};

/** Markets from Perpl's public context (decimals per market). Changes rarely: cached an hour. */
export const perpMarkets = (net: Net = "mainnet") =>
  swr(`perpl:markets:${net}`, 60 * 60_000, async (): Promise<PerpMarket[]> => {
    const j = (await fetch(`${PERPL[net].api}/v1/pub/context`).then((r) => r.json())) as {
      markets: { id: number; name: string; symbol: string; order_ttl_blocks: number; config: { is_open: boolean; price_decimals: number; size_decimals: number; initial_margin: number; maintenance_margin: number; taker_fee: number } }[];
    };
    return j.markets.map((m) => ({
      id: m.id,
      name: m.symbol || m.name,
      priceDecimals: m.config.price_decimals,
      sizeDecimals: m.config.size_decimals,
      maxLeverage: m.config.initial_margin / 100,
      maintLeverage: m.config.maintenance_margin / 100,
      takerFee: m.config.taker_fee,
      ttlBlocks: m.order_ttl_blocks,
      open: m.config.is_open,
    }));
  });

const PAGE = 200n;
const entryOf = (p: { pricePNS: bigint }, m: PerpMarket) => Number(p.pricePNS) / 10 ** m.priceDecimals;

/** Every open position in one market, walking the contract's linked list a page at a time. */
async function marketPositions(net: Net, m: PerpMarket): Promise<Omit<PerpPosition, "address">[]> {
  const { client, exchange } = PERPL[net];
  const perp = BigInt(m.id);
  const [start] = await client.readContract({ address: exchange, abi: perplAbi, functionName: "getPositionIds", args: [perp] });
  const out: Omit<PerpPosition, "address">[] = [];
  let next = start;
  // ponytail: sequential pages; fine for a few thousand positions per market.
  for (let guard = 0; next !== 0n && guard < 100; guard++) {
    const [rows, , markPNS] = await client.readContract({ address: exchange, abi: perplAbi, functionName: "getPositionsV2", args: [perp, next, PAGE] });
    const mark = Number(markPNS) / 10 ** m.priceDecimals;
    for (const p of rows) {
      if (p.lotLNS === 0n) continue;
      const size = Number(p.lotLNS) / 10 ** m.sizeDecimals;
      const deposit = Number(p.depositCNS) / CNS;
      const notional = size * mark;
      out.push({
        marketId: m.id,
        market: m.name,
        account: Number(p.accountId),
        side: p.positionType === 0 ? "long" : "short",
        size,
        entry: entryOf(p, m),
        mark,
        notional,
        deposit,
        leverage: deposit > 0 ? notional / deposit : 0,
        pnl: Number(p.pnlCNS) / CNS,
        // SDK: liq = entry ± (maintenance requirement − deposit) / size, requirement = entry × size / maintLeverage.
        liquidation: size > 0 ? Math.max(0, entryOf(p, m) + (p.positionType === 0 ? 1 : -1) * ((entryOf(p, m) * size) / m.maintLeverage - deposit) / size) : 0,
      });
    }
    const last = rows.at(-1);
    next = rows.length < Number(PAGE) || !last ? 0n : last.nextNodeId;
  }
  return out;
}

/** Account id → wallet address, for the given ids. Accounts never change owner, so cache for a day. */
async function addresses(net: Net, ids: number[]): Promise<Map<number, string>> {
  const { client, exchange } = PERPL[net];
  const known = await swr(`perpl:addr:${net}`, 24 * 60 * 60_000, async () => new Map<number, string>());
  const missing = [...new Set(ids)].filter((id) => !known.has(id));
  if (missing.length) {
    const infos = await client.multicall({
      allowFailure: true,
      contracts: missing.map((id) => ({ address: exchange, abi: perplAbi, functionName: "getAccountById", args: [BigInt(id)] }) as const),
    });
    missing.forEach((id, i) => {
      const r = infos[i];
      if (r.status === "success") known.set(id, r.result.accountAddr.toLowerCase());
    });
  }
  return known;
}

/** Every open position on Perpl with its owner's address. Cached a minute. */
export const perpPositions = (net: Net = "mainnet") =>
  swr(`perpl:positions:${net}`, 60_000, async (): Promise<PerpPosition[]> => {
    const markets = (await perpMarkets(net)).filter((m) => m.open);
    const all = (await Promise.all(markets.map((m) => marketPositions(net, m)))).flat();
    const addr = await addresses(net, all.map((p) => p.account));
    return all.map((p) => ({ ...p, address: addr.get(p.account) ?? "" }));
  });

export type PerpTicker = { mark: number; prev: number; volume24h: number; openInterest: number };

/** Per-market mark, 24h-ago price, 24h volume and open interest (USD) from Perpl's public ticker. Cached 15 s. */
export const perpTickers = (net: Net) =>
  swr(`perpl:ticker:${net}`, 15_000, async (): Promise<Record<number, PerpTicker>> => {
    const [j, markets] = await Promise.all([
      fetch(`${PERPL[net].api}/v1/market-data/ticker`, { cache: "no-store" }).then((r) => r.json() as Promise<{ d: Record<string, { mrk: number; prv: number; dva: string; oi: number }> }>),
      perpMarkets(net),
    ]);
    const out: Record<number, PerpTicker> = {};
    for (const m of markets) {
      const t = j.d[String(m.id)];
      if (!t) continue;
      const mark = t.mrk / 10 ** m.priceDecimals;
      // dva: 24h volume in AUSD atoms (6 decimals); oi: open interest in lots.
      out[m.id] = { mark, prev: t.prv / 10 ** m.priceDecimals, volume24h: Number(t.dva) / 1e6, openInterest: (t.oi / 10 ** m.sizeDecimals) * mark };
    }
    return out;
  });

export type PerpTrader = { address: string; positions: PerpPosition[]; notional: number; pnl: number; deposit: number };

/** Open positions grouped per wallet, biggest book first. */
export function tradersFrom(positions: PerpPosition[]): PerpTrader[] {
  const by = new Map<string, PerpTrader>();
  for (const p of positions) {
    if (!p.address) continue;
    const t = by.get(p.address) ?? by.set(p.address, { address: p.address, positions: [], notional: 0, pnl: 0, deposit: 0 }).get(p.address)!;
    t.positions.push(p);
    t.notional += p.notional;
    t.pnl += p.pnl;
    t.deposit += p.deposit;
  }
  return [...by.values()].sort((a, b) => b.notional - a.notional);
}

export type PerpRow = {
  address: string;
  equity: number; // free balance + margin in positions + open PnL
  /** All-time PnL: equity minus net deposits (fees and funding included). Null without the indexer. */
  allTime: number | null;
  netDeposits: number | null;
  liquidations: number;
  open: PerpPosition[];
  unrealized: number;
  notional: number;
  leverage: number; // open notional / open margin
};
export type PerpBoard = { rows: PerpRow[]; history: boolean; markets: number; positions: number; holders: number; openInterest: number; volume24h: number; marketStats: PerpMarketStat[] };

/** Every Perpl account (indexer) by address, cached 5 min. Null without the indexer. */
const perplAccounts = () =>
  indexerUrl() ? swr("perpl:accounts", 5 * 60_000, async () => new Map((await indexedPerplAccounts()).map((a) => [a.address, a]))).catch(() => null) : Promise.resolve(null);

/** Free AUSD per account id, read from the contract. */
async function balances(ids: number[]): Promise<Map<number, number>> {
  const { client, exchange } = PERPL.mainnet;
  const r = await client.multicall({ allowFailure: true, contracts: ids.map((id) => ({ address: exchange, abi: perplAbi, functionName: "getAccountById", args: [BigInt(id)] }) as const) });
  return new Map(ids.map((id, i) => [id, r[i].status === "success" ? Number((r[i].result as { balanceCNS: bigint }).balanceCNS) / CNS : 0]));
}

/** Perpl traders holding positions now: equity and open PnL (contract), all-time PnL and liquidations (indexer). Cached 2 min. */
export const perpBoard = () =>
  swr("perpl:board", 2 * 60_000, async (): Promise<PerpBoard> => {
    const [positions, accounts, markets, tickers, funding] = await Promise.all([
      perpPositions(),
      perplAccounts(),
      perpMarkets("mainnet"),
      perpTickers("mainnet").catch(() => ({}) as Record<number, PerpTicker>),
      perpFunding("mainnet").catch(() => ({}) as Record<number, number>),
    ]);
    const stats = marketStats(markets, positions, tickers, funding);
    const traders = tradersFrom(positions);
    const free = await balances(traders.map((t) => t.positions[0].account));
    const rows: PerpRow[] = traders.map((t) => {
      const a = accounts?.get(t.address);
      const equity = (free.get(t.positions[0].account) ?? 0) + t.deposit + t.pnl;
      const net = a ? a.depositedUsd - a.withdrawnUsd : null;
      return {
        address: t.address,
        equity,
        allTime: net === null ? null : equity - net,
        netDeposits: net,
        liquidations: a?.liquidations ?? 0,
        open: t.positions.sort((x, y) => y.notional - x.notional),
        unrealized: t.pnl,
        notional: t.notional,
        leverage: t.deposit > 0 ? t.notional / t.deposit : 0,
      };
    });
    const score = (r: PerpRow) => r.allTime ?? r.unrealized;
    return {
      rows: rows.sort((a, b) => score(b) - score(a)).slice(0, 200),
      history: !!accounts,
      markets: new Set(positions.map((p) => p.marketId)).size,
      positions: positions.length,
      holders: new Set(positions.map((p) => p.address)).size,
      openInterest: positions.filter((p) => p.side === "long").reduce((s, p) => s + p.notional, 0),
      volume24h: stats.reduce((s, m) => s + m.volume24h, 0),
      marketStats: stats,
    };
  });

/** Latest funding rate per market, as % per hour (positive: longs pay shorts). Cached 5 min. */
export const perpFunding = (net: Net) =>
  swr(`perpl:funding:${net}`, 5 * 60_000, async (): Promise<Record<number, number>> => {
    const now = Date.now();
    const j = (await fetch(`${PERPL[net].api}/v1/market-data/funding/${now - 3 * 3600_000}-${now}`, { cache: "no-store" }).then((r) => r.json())) as { d: Record<string, { at: { t: number }; rate: number }[]> };
    const out: Record<number, number> = {};
    for (const [id, events] of Object.entries(j.d ?? {})) {
      const last = events.at(-1);
      const prev = events.at(-2);
      if (!last) continue;
      const intervalH = prev ? (last.at.t - prev.at.t) / 3600_000 : 2580 / 3600; // Perpl's interval is 43 min
      out[Number(id)] = (last.rate / 1e6) * 100 / (intervalH || 1);
    }
    return out;
  });

export type PerpMarketStat = {
  id: number;
  name: string;
  mark: number;
  change24h: number;
  volume24h: number;
  openInterest: number; // USD per side
  longShare: number; // % of open positions that are long (notional is equal per side, so count shows sentiment)
  avgLeverage: number; // notional-weighted
  fundingHourly: number | null; // % per hour
  atRisk: number; // positions within 5% of their liquidation price
  positions: number;
};

/** Protocol view per market: price, volume, OI, who is long vs short, leverage and positions close to liquidation. */
export function marketStats(markets: PerpMarket[], positions: PerpPosition[], tickers: Record<number, PerpTicker>, funding: Record<number, number>): PerpMarketStat[] {
  return markets
    .filter((m) => m.open)
    .map((m) => {
      const ps = positions.filter((p) => p.marketId === m.id);
      const t = tickers[m.id];
      const notional = ps.reduce((s, p) => s + p.notional, 0);
      const longs = ps.filter((p) => p.side === "long").length;
      return {
        id: m.id,
        name: m.name,
        mark: t?.mark ?? ps[0]?.mark ?? 0,
        change24h: t && t.prev ? ((t.mark - t.prev) / t.prev) * 100 : 0,
        volume24h: t?.volume24h ?? 0,
        openInterest: t?.openInterest ?? notional / 2,
        longShare: ps.length ? (longs / ps.length) * 100 : 50,
        avgLeverage: notional ? ps.reduce((s, p) => s + p.leverage * p.notional, 0) / notional : 0,
        fundingHourly: funding[m.id] ?? null,
        atRisk: ps.filter((p) => p.liquidation > 0 && Math.abs(p.mark - p.liquidation) / p.mark < 0.05).length,
        positions: ps.length,
      };
    })
    .sort((a, b) => b.volume24h - a.volume24h);
}

const AUSD_MAINNET: Address = "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a";

/** Protocol volume per UTC day (USD), summed over every market's official daily candles. Cached 30 min. */
export const perpDailyVolume = (days = 30) =>
  swr(`perpl:volume:${days}`, 30 * 60_000, async (): Promise<{ day: number; usd: number; trades: number }[]> => {
    const markets = await perpMarkets("mainnet");
    const to = Date.now();
    const from = to - days * 86_400_000;
    const per = await Promise.all(
      markets.map((m) =>
        fetch(`${PERPL.mainnet.api}/v1/market-data/${m.id}/candles/86400/${from}-${to}`, { cache: "no-store" })
          .then((r) => r.json() as Promise<{ d?: { t: number; v: string; n: number }[] }>)
          .then((j) => j.d ?? [], () => []),
      ),
    );
    const byDay = new Map<number, { usd: number; trades: number }>();
    for (const candles of per)
      for (const c of candles) {
        const day = Math.floor(c.t / 86_400_000);
        const d = byDay.get(day) ?? { usd: 0, trades: 0 };
        byDay.set(day, { usd: d.usd + Number(c.v) / 1e6, trades: d.trades + c.n }); // v: AUSD atoms
      }
    return [...byDay].sort((a, b) => a[0] - b[0]).map(([day, d]) => ({ day, ...d }));
  });

export type AtRisk = PerpPosition & { distance: number };
export type PerpRisk = {
  tvl: number; // AUSD held by the Exchange contract
  openInterest: number;
  volume24h: number;
  markets: (PerpMarketStat & { liqMap: LiqBucket[] })[];
  atRisk: AtRisk[]; // the 25 closest to liquidation (within 10%), closest first
  near: { count: number; notional: number }; // every position within 5% of liquidation
  volume: { day: number; usd: number; trades: number }[]; // last 30 days, from Perpl's candles
  daily: IndexedPerplDaily[] | null; // flows and liquidations, last 30 days; null without the indexer
  liquidations: IndexedPerplLiquidation[] | null; // latest, null without the indexer
};

/** Perpl risk dashboard: liquidation map per market, positions closest to liquidation, protocol health. Cached 1 min. */
export const perpRisk = () =>
  swr("perpl:risk", 60_000, async (): Promise<PerpRisk> => {
    const today = Math.floor(Date.now() / 86_400_000);
    const [positions, markets, tickers, funding, tvl, daily, liquidations, volume] = await Promise.all([
      perpPositions("mainnet"),
      perpMarkets("mainnet"),
      perpTickers("mainnet").catch(() => ({}) as Record<number, PerpTicker>),
      perpFunding("mainnet").catch(() => ({}) as Record<number, number>),
      PERPL.mainnet.client.readContract({ address: AUSD_MAINNET, abi: erc20Abi, functionName: "balanceOf", args: [PERPL.mainnet.exchange] }),
      indexerUrl() ? indexedPerplDaily(today - 30).catch(() => null) : Promise.resolve(null),
      indexerUrl() ? indexedPerplLiquidations(undefined, 20).catch(() => null) : Promise.resolve(null),
      perpDailyVolume(30).catch(() => []),
    ]);
    const stats = marketStats(markets, positions, tickers, funding);
    const withDistance = positions.map((p) => ({ ...p, distance: liqDistance(p.side, p.mark, p.liquidation) })).filter((p) => p.address);
    const near = withDistance.filter((p) => p.distance < 0.05);
    return {
      tvl: Number(tvl) / 1e6,
      near: { count: near.length, notional: near.reduce((s, p) => s + p.notional, 0) },
      openInterest: stats.reduce((s, m) => s + m.openInterest, 0),
      volume24h: stats.reduce((s, m) => s + m.volume24h, 0),
      markets: stats.map((m) => ({ ...m, liqMap: liquidationMap(positions.filter((p) => p.marketId === m.id), m.mark) })),
      atRisk: withDistance
        .filter((p) => p.distance < 0.1)
        .sort((a, b) => a.distance - b.distance || b.notional - a.notional)
        .slice(0, 25),
      volume,
      daily,
      liquidations,
    };
  });

export type WalletRisk = {
  account: number | null;
  free: number; // AUSD available for new margin (balance minus what resting orders lock)
  locked: number; // AUSD reserved by resting orders (part of the balance)
  margin: number; // AUSD in open positions
  equity: number; // balance + margin + open PnL
  marginUse: number; // margin / equity, %
  open: (PerpPosition & { distance: number })[];
  /** From the indexer (null without it): money in and out, all-time PnL (equity − net deposits) and liquidations. */
  history: { deposited: number; withdrawn: number; allTime: number; liquidations: IndexedPerplLiquidation[]; liquidatedUsd: number } | null;
};

/** One wallet's Perpl risk profile: margin, distance to liquidation per position, all-time PnL and liquidations. */
export async function walletRisk(address: string): Promise<WalletRisk | null> {
  const a = address.toLowerCase();
  const [positions, info, accounts, liquidations] = await Promise.all([
    perpPositions("mainnet"),
    PERPL.mainnet.client.readContract({ address: PERPL.mainnet.exchange, abi: perplAbi, functionName: "getAccountByAddr", args: [a as Address] }).catch(() => null),
    perplAccounts(),
    indexerUrl() ? indexedPerplLiquidations(a, 30).catch(() => null) : Promise.resolve(null),
  ]);
  if (!info) return null;
  const open = positions.filter((p) => p.address === a).map((p) => ({ ...p, distance: liqDistance(p.side, p.mark, p.liquidation) }));
  const balance = Number(info.balanceCNS) / 1e6;
  const locked = Number(info.lockedBalanceCNS) / 1e6;
  const margin = open.reduce((s, p) => s + p.deposit, 0);
  const equity = balance + margin + open.reduce((s, p) => s + p.pnl, 0);
  const acct: IndexedPerplAccount | undefined = accounts?.get(a);
  return {
    account: Number(info.accountId),
    free: Math.max(0, balance - locked),
    locked,
    margin,
    equity,
    marginUse: equity > 0 ? (margin / equity) * 100 : 0,
    open: open.sort((x, y) => x.distance - y.distance),
    history: acct
      ? { deposited: acct.depositedUsd, withdrawn: acct.withdrawnUsd, allTime: equity - (acct.depositedUsd - acct.withdrawnUsd), liquidations: liquidations ?? [], liquidatedUsd: acct.liquidatedUsd }
      : null,
  };
}
