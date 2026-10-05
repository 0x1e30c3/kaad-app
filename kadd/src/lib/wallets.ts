// Real Monad *mainnet* wallets: who is trading the tokens Kadd mirrors, from each pool's latest trades on
// GeckoTerminal (last 300 per pool, so a window of hours, not days), plus a wallet's balances from mainnet RPC.
import "server-only";
import { erc20Abi, formatUnits, type Address } from "viem";
import { kaddPoolAbi, kaddVenueAbi, mirrorTokenAbi } from "./abi";
import { VENUE } from "./addresses";
import { publicClient } from "./chain";
import { getLeaderboard, type BoardRow } from "./leaderboard";
import { poolTrades, quotes, type PoolTrade } from "./market";
import { swr } from "./cache";
import { mainnet, profiles, type Profile } from "./nns";
import { smartMoney } from "./nansen";

export type TokenMini = { address: string; symbol: string; image: string | null; price: number };
export type WalletTrade = PoolTrade & { token: TokenMini };
export type MainnetRow = Profile & {
  address: string;
  volume: number;
  trades: number;
  buys: number;
  sells: number;
  net: number; // USD sold − USD bought in the window: positive = took money out
  tokens: TokenMini[];
  lastAt: number;
  series: { t: number; v: number }[]; // cumulative volume across the window
  copyPnl: number; // backtest: copying $10 per buy
  copyRoi: number;
  /** Nansen smart-money label when Nansen tracks this wallet as smart money ("" = smart money, no label). */
  smart: string | null;
};
export type MainnetBoard = { rows: MainnetRow[]; since: number | null; failed: boolean };
export type WalletView = Profile & {
  address: string;
  trades: WalletTrade[];
  since: number | null;
  holdings: { token: TokenMini; amount: number; usd: number }[] | null; // null = mainnet RPC unavailable
  mon: number | null;
  kadd: BoardRow | null; // the same address on the Kadd testnet leaderboard (30d)
};

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** The mainnet tokens Kadd mirrors on testnet: the markets users can actually trade here. Pools rarely change. */
const tracked = () => swr("tracked", 10 * 60_000, readTracked);
async function readTracked() {
  const pools = await publicClient.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "allPools" });
  const bases = await publicClient.multicall({ allowFailure: false, contracts: pools.map((p) => ({ address: p, abi: kaddPoolAbi, functionName: "baseToken" }) as const) });
  const sources = await publicClient.multicall({ allowFailure: false, contracts: bases.map((b) => ({ address: b, abi: mirrorTokenAbi, functionName: "source" }) as const) });
  const q = await quotes(sources);
  return sources
    .map((s) => s.toLowerCase())
    .filter((s) => q[s])
    .map((s) => ({ address: s, symbol: q[s].symbol, image: q[s].image, price: q[s].price, pool: q[s].pool }));
}

/** Latest mainnet trades across tracked tokens, newest first. A pool that fails is skipped. */
// ponytail: 2 min keeps background use to ~3 GeckoTerminal calls/minute; a paid data API would allow faster copies.
export const recentTrades = () => swr("recentTrades", 120_000, readRecentTrades);
async function readRecentTrades() {
  const tokens = await tracked();
  const lists = await Promise.all(
    tokens.map(({ pool, ...token }) => poolTrades(pool, token.address).then((ts) => ts.map((t): WalletTrade => ({ ...t, token })), () => null)),
  );
  const trades = lists.flatMap((l) => l ?? []).sort((a, b) => b.at - a.at);
  return { tokens: tokens.map(({ address, symbol, image, price }) => ({ address, symbol, image, price })), trades, failed: lists.every((l) => l === null) };
}

/** What copying a wallet would have returned: `size` tUSDC per buy at the leader's price, exiting the whole position
 * when the leader sells, and anything still held marked at today's price. Fees and slippage are left out. */
export type Backtest = { pnl: number; roi: number; invested: number; copied: number; closed: number; winRate: number | null; curve: { t: number; v: number }[] };
export function backtest(trades: WalletTrade[], size = 10, now = Date.now()): Backtest {
  const pos = new Map<string, { qty: number; cost: number }>();
  const last = new Map<string, number>();
  let cash = 0, invested = 0, copied = 0, closed = 0, wins = 0;
  const marked = (price: (token: string) => number) => cash + [...pos].reduce((s, [k, p]) => s + p.qty * price(k), 0);
  const curve: Backtest["curve"] = [];
  for (const t of [...trades].sort((a, b) => a.at - b.at)) {
    if (!(t.price > 0)) continue;
    const k = t.token.address;
    last.set(k, t.price);
    const p = pos.get(k);
    if (t.side === "buy") {
      pos.set(k, { qty: (p?.qty ?? 0) + size / t.price, cost: (p?.cost ?? 0) + size });
      cash -= size;
      invested += size;
    } else if (p) {
      const proceeds = p.qty * t.price;
      cash += proceeds;
      closed++;
      if (proceeds > p.cost) wins++;
      pos.delete(k);
    } else continue; // a sell of something we never copied a buy of
    copied++;
    curve.push({ t: Math.round(t.at / 1000), v: marked((tok) => last.get(tok) ?? 0) });
  }
  const current = new Map(trades.map((t) => [t.token.address, t.token.price]));
  const pnl = marked((tok) => current.get(tok) ?? last.get(tok) ?? 0);
  if (curve.length) curve.push({ t: Math.round(now / 1000), v: pnl });
  return { pnl, roi: invested ? (pnl / invested) * 100 : 0, invested, copied, closed, winRate: closed ? (wins / closed) * 100 : null, curve };
}

export function aggregate(trades: WalletTrade[], now = Date.now()): MainnetRow[] {
  const since = trades.length ? Math.min(...trades.map((t) => t.at)) : now;
  const by = new Map<string, WalletTrade[]>();
  for (const t of trades) by.set(t.trader, [...(by.get(t.trader) ?? []), t]);
  return [...by]
    .map(([address, ts]) => {
      const bought = sum(ts.filter((t) => t.side === "buy").map((t) => t.usd));
      const volume = sum(ts.map((t) => t.usd));
      const tokens = [...new Map(ts.map((t) => [t.token.address, t.token])).values()];
      const series = Array.from({ length: 8 }, (_, i) => {
        const at = since + ((now - since) * i) / 7;
        return { t: Math.round(at / 1000), v: sum(ts.filter((t) => t.at <= at).map((t) => t.usd)) };
      });
      const buys = ts.filter((t) => t.side === "buy").length;
      const bt = backtest(ts, 10, now);
      return { address, nns: null, avatar: null, smart: null, copyPnl: bt.pnl, copyRoi: bt.roi, volume, trades: ts.length, buys, sells: ts.length - buys, net: volume - 2 * bought, tokens, lastAt: Math.max(...ts.map((t) => t.at)), series };
    })
    .sort((a, b) => b.volume - a.volume);
}

export const getMainnetBoard = (): Promise<MainnetBoard> =>
  swr("mainnetBoard", 60_000, async () => {
    const { trades, failed } = await recentTrades();
    const rows = aggregate(trades).slice(0, 100);
    const [names, sm] = await Promise.all([profiles(rows.map((r) => r.address)), smartMoney()]);
    const smart = new Map(sm?.wallets.map((w) => [w.address, w.label ?? ""]));
    return {
      rows: rows.map((r) => ({ ...r, ...names.get(r.address), smart: smart.get(r.address) ?? null })),
      since: trades.length ? trades[trades.length - 1].at : null,
      failed,
    };
  }).catch((e) => {
    console.error("mainnet board failed", e);
    return { rows: [], since: null, failed: true };
  });

export async function getWallet(address: Address): Promise<WalletView> {
  const a = address.toLowerCase();
  const tokens = await tracked().catch(() => []);
  const [{ trades }, board, names, balances, mon] = await Promise.all([
    recentTrades().catch(() => ({ trades: [] as WalletTrade[], failed: true })),
    getLeaderboard(),
    swr(`nns:${a}`, 10 * 60_000, () => profiles([a])),
    mainnet
      .multicall({
        allowFailure: false,
        contracts: tokens.flatMap((t) => [
          { address: t.address as Address, abi: erc20Abi, functionName: "balanceOf", args: [address] },
          { address: t.address as Address, abi: erc20Abi, functionName: "decimals" },
        ] as const),
      })
      .catch(() => null),
    mainnet.getBalance({ address }).catch(() => null),
  ]);
  const holdings = balances
    ? tokens
        .map((token, i) => {
          const amount = Number(formatUnits(balances[i * 2] as bigint, balances[i * 2 + 1] as number));
          return { token, amount, usd: amount * token.price };
        })
        .filter((h) => h.amount > 0)
        .sort((x, y) => y.usd - x.usd)
    : null;
  return {
    address: a,
    nns: names.get(a)?.nns ?? null,
    avatar: names.get(a)?.avatar ?? null,
    trades: trades.filter((t) => t.trader === a),
    since: trades.length ? trades[trades.length - 1].at : null,
    holdings,
    mon: mon === null ? null : Number(formatUnits(mon, 18)),
    kadd: board.traders["30"].find((r) => r.address === a) ?? null,
  };
}

export type FeedItem = WalletTrade & Profile;

/** Latest mainnet trades by the given wallets (newest first), with their .nad names. */
export async function getFeed(wallets: string[]): Promise<FeedItem[]> {
  const set = new Set(wallets.map((w) => w.toLowerCase()));
  const { trades } = await recentTrades();
  const items = trades.filter((t) => set.has(t.trader)).slice(0, 60);
  const key = [...new Set(items.map((t) => t.trader))].sort();
  const names = await swr(`nns:${key.join(",")}`, 10 * 60_000, () => profiles(key));
  return items.map((t) => ({ ...t, nns: names.get(t.trader)?.nns ?? null, avatar: names.get(t.trader)?.avatar ?? null }));
}
