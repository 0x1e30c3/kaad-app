// Perpl (perpetual futures on Monad): every open position on mainnet, read straight from the Exchange contract.
// getPositionsV2 pages through each market's position list with unrealized PnL, so live "who holds what" needs no
// indexer; realized PnL history comes from the Kadd indexer (indexer/, Perpl Exchange on chain 143).
import "server-only";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { monad, monadTestnet } from "viem/chains";
import { swr } from "./cache";
import { indexedPerplDays, indexerUrl } from "./indexer";

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

export type PerpMarket = { id: number; name: string; priceDecimals: number; sizeDecimals: number; open: boolean; ttlBlocks: number };
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
};

/** Markets from Perpl's public context (decimals per market). Changes rarely: cached an hour. */
export const perpMarkets = (net: Net = "mainnet") =>
  swr(`perpl:markets:${net}`, 60 * 60_000, async (): Promise<PerpMarket[]> => {
    const j = (await fetch(`${PERPL[net].api}/v1/pub/context`).then((r) => r.json())) as {
      markets: { id: number; name: string; symbol: string; order_ttl_blocks: number; config: { is_open: boolean; price_decimals: number; size_decimals: number } }[];
    };
    return j.markets.map((m) => ({ id: m.id, name: m.symbol || m.name, priceDecimals: m.config.price_decimals, sizeDecimals: m.config.size_decimals, open: m.config.is_open, ttlBlocks: m.order_ttl_blocks }));
  });

const PAGE = 200n;

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
        entry: Number(p.pricePNS) / 10 ** m.priceDecimals,
        mark,
        notional,
        deposit,
        leverage: deposit > 0 ? notional / deposit : 0,
        pnl: Number(p.pnlCNS) / CNS,
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
  /** Realized over the last 30 days (closes, partial closes, liquidations; incl. funding, before fees). Null without the indexer. */
  realized: number | null;
  closes: number;
  wins: number;
  liquidations: number;
  open: PerpPosition[];
  unrealized: number;
  notional: number;
  leverage: number; // open notional / open margin
};
export type PerpBoard = { rows: PerpRow[]; realized: boolean; markets: number; positions: number; holders: number; openInterest: number };

/** Perpl traders: realized PnL over 30 days (indexer) joined with what they hold right now (contract). Cached 2 min. */
export const perpBoard = () =>
  swr("perpl:board", 2 * 60_000, async (): Promise<PerpBoard> => {
    const since = Math.floor(Date.now() / 86_400_000) - 30;
    const [positions, days] = await Promise.all([perpPositions(), indexerUrl() ? indexedPerplDays(since).catch(() => null) : Promise.resolve(null)]);
    const rows = new Map<string, PerpRow>();
    const row = (a: string) => rows.get(a) ?? rows.set(a, { address: a, realized: days ? 0 : null, closes: 0, wins: 0, liquidations: 0, open: [], unrealized: 0, notional: 0, leverage: 0 }).get(a)!;
    for (const d of days ?? []) {
      if (!d.address) continue;
      const r = row(d.address);
      r.realized = (r.realized ?? 0) + d.pnlUsd;
      r.closes += d.closes;
      r.wins += d.wins;
      r.liquidations += d.liquidations;
    }
    for (const t of tradersFrom(positions)) {
      const r = row(t.address);
      r.open = t.positions.sort((a, b) => b.notional - a.notional);
      r.unrealized = t.pnl;
      r.notional = t.notional;
      r.leverage = t.deposit > 0 ? t.notional / t.deposit : 0;
    }
    const score = (r: PerpRow) => (r.realized ?? 0) + r.unrealized;
    return {
      rows: [...rows.values()].sort((a, b) => score(b) - score(a)).slice(0, 200),
      realized: !!days,
      markets: new Set(positions.map((p) => p.marketId)).size,
      positions: positions.length,
      holders: new Set(positions.map((p) => p.address)).size,
      openInterest: positions.filter((p) => p.side === "long").reduce((s, p) => s + p.notional, 0),
    };
  });
