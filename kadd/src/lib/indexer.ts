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

export type IndexedPerplDay = { account: string; address: string; day: number; pnlUsd: number; closes: number; wins: number; liquidations: number };

/** Perpl realized PnL per account and UTC day since `sinceDay` (Perpl on Monad mainnet, from the same indexer). */
export async function indexedPerplDays(sinceDay: number): Promise<IndexedPerplDay[]> {
  const out: IndexedPerplDay[] = [];
  for (let offset = 0; offset < MAX; offset += PAGE) {
    const { PerplTraderDay } = await gql<{ PerplTraderDay: IndexedPerplDay[] }>(
      `query($since: Int!, $limit: Int!, $offset: Int!) {
        PerplTraderDay(where: { day: { _gte: $since } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
          account address day pnlUsd closes wins liquidations
        }
      }`,
      { since: sinceDay, limit: PAGE, offset },
    );
    out.push(...PerplTraderDay.map((d) => ({ ...d, pnlUsd: Number(d.pnlUsd) })));
    if (PerplTraderDay.length < PAGE) break;
  }
  return out;
}
