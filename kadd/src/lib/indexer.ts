// Kadd's Envio HyperIndex indexer (/indexer): every swap already attributed to whoever's money it was (wallet, club,
// or the owner of a strategy / copy vault), plus clubs and deposits. Used by Stats and the Kadd leaderboard when
// ENVIO_INDEXER_URL points at the indexer's GraphQL endpoint; they fall back to raw HyperRPC logs otherwise.
import "server-only";

export const indexerUrl = () => process.env.ENVIO_INDEXER_URL || null;

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const url = indexerUrl();
  if (!url) throw new Error("ENVIO_INDEXER_URL is not set");
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }), cache: "no-store" });
  const j = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
  if (!res.ok || !j?.data) throw new Error(`Indexer query failed: ${j?.errors?.[0]?.message ?? res.status}`);
  return j.data;
}

export type IndexedSwap = { trader: string; pool: string; kind: string; isBuy: boolean; usd: number; tokens: number; timestamp: number };
const PAGE = 1000;
const MAX = 50_000; // ponytail: whole history in memory; move PnL aggregation into the indexer past this

/** Every indexed swap since `since` (unix seconds), oldest first. */
export async function indexedSwaps(since = 0): Promise<IndexedSwap[]> {
  const out: IndexedSwap[] = [];
  for (let offset = 0; offset < MAX; offset += PAGE) {
    const { Swap } = await gql<{ Swap: IndexedSwap[] }>(
      `query($since: Int!, $limit: Int!, $offset: Int!) {
        Swap(where: { timestamp: { _gte: $since } }, order_by: { timestamp: asc }, limit: $limit, offset: $offset) {
          trader pool kind isBuy usd tokens timestamp
        }
      }`,
      { since, limit: PAGE, offset },
    );
    // Envio serves Float fields as Postgres numeric, which Hasura returns as strings.
    out.push(...Swap.map((x) => ({ ...x, usd: Number(x.usd), tokens: Number(x.tokens), timestamp: Number(x.timestamp) })));
    if (Swap.length < PAGE) break;
  }
  return out;
}

export async function indexedClubs(): Promise<{ id: string; name: string }[]> {
  return (await gql<{ Club: { id: string; name: string }[] }>(`{ Club(limit: 1000) { id name } }`)).Club;
}

/** Members who ever deposited into a club (they count as active wallets even without a swap). */
export async function indexedDepositors(): Promise<{ member: string }[]> {
  return (await gql<{ ClubDeposit: { member: string }[] }>(`{ ClubDeposit(limit: 10000) { member } }`)).ClubDeposit;
}

export type IndexedPerplAccount = { id: string; address: string; depositedUsd: number; withdrawnUsd: number; liquidations: number; liquidatedUsd: number };

/** Every Perpl account with money it put in and took out, and its liquidations (Perpl on Monad mainnet). */
export async function indexedPerplAccounts(): Promise<IndexedPerplAccount[]> {
  const out: IndexedPerplAccount[] = [];
  for (let offset = 0; offset < MAX; offset += PAGE) {
    const { PerplAccount } = await gql<{ PerplAccount: IndexedPerplAccount[] }>(
      `query($limit: Int!, $offset: Int!) {
        PerplAccount(order_by: { id: asc }, limit: $limit, offset: $offset) { id address depositedUsd withdrawnUsd liquidations liquidatedUsd }
      }`,
      { limit: PAGE, offset },
    );
    out.push(...PerplAccount.map((a) => ({ ...a, depositedUsd: Number(a.depositedUsd), withdrawnUsd: Number(a.withdrawnUsd), liquidatedUsd: Number(a.liquidatedUsd) })));
    if (PerplAccount.length < PAGE) break;
  }
  return out;
}

export type IndexedPerplDaily = { day: number; newAccounts: number; deposits: number; depositedUsd: number; withdrawals: number; withdrawnUsd: number; liquidations: number; liquidatedUsd: number };

/** Perpl money flows and liquidations per UTC day since `sinceDay`, oldest first. */
export async function indexedPerplDaily(sinceDay: number): Promise<IndexedPerplDaily[]> {
  const { PerplDaily } = await gql<{ PerplDaily: IndexedPerplDaily[] }>(
    `query($since: Int!) {
      PerplDaily(where: { day: { _gte: $since } }, order_by: { day: asc }, limit: 1000) {
        day newAccounts deposits depositedUsd withdrawals withdrawnUsd liquidations liquidatedUsd
      }
    }`,
    { since: sinceDay },
  );
  return PerplDaily.map((d) => ({ ...d, depositedUsd: Number(d.depositedUsd), withdrawnUsd: Number(d.withdrawnUsd), liquidatedUsd: Number(d.liquidatedUsd) }));
}

export type IndexedPerplLiquidation = { address: string; symbol: string; side: string; notionalUsd: number; price: number; pnlUsd: number; full: boolean; timestamp: number };

/** Latest Perpl liquidations, newest first; one wallet's when `address` is given. */
export async function indexedPerplLiquidations(address?: string, limit = 50): Promise<IndexedPerplLiquidation[]> {
  const { PerplLiquidation } = await gql<{ PerplLiquidation: IndexedPerplLiquidation[] }>(
    `query($where: PerplLiquidation_bool_exp!, $limit: Int!) {
      PerplLiquidation(where: $where, order_by: { timestamp: desc }, limit: $limit) { address symbol side notionalUsd price pnlUsd full timestamp }
    }`,
    { where: address ? { address: { _eq: address.toLowerCase() } } : {}, limit },
  );
  return PerplLiquidation.map((l) => ({ ...l, notionalUsd: Number(l.notionalUsd), price: Number(l.price), pnlUsd: Number(l.pnlUsd) }));
}
