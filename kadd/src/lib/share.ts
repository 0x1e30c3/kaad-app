// Data behind the shareable cards and the public vault page. Reuses the cached reads (mainnet trades, Nansen, NNS,
// Kadd event history); the only fresh read is one multicall for a vault's current state.
import "server-only";
import { formatUnits } from "viem";
import { kaddCopyAbi, kaddCopyClubsAbi, kaddPoolAbi, kaddVenueAbi, mirrorTokenAbi } from "./abi";
import { COPY, COPY_CLUBS, VENUE } from "./addresses";
import { publicClient } from "./chain";
import { copyStats, kaddLogs } from "./events";
import { smartWallet } from "./nansen";
import { profiles } from "./nns";
import { swr } from "./cache";
import { backtest, recentTrades } from "./wallets";

export type WalletCard = {
  address: string;
  name: string | null;
  avatar: string | null;
  smart: { label: string | null; pnl30d: number; winRate: number; trades: number } | null;
  backtest: { roi: number; pnl: number; copied: number };
  copiers: number;
};

export async function walletCard(address: string): Promise<WalletCard> {
  const a = address.toLowerCase();
  const [{ trades }, smart, names, copy] = await Promise.all([
    recentTrades().catch(() => ({ trades: [] })),
    smartWallet(a),
    swr(`nns:${a}`, 10 * 60_000, () => profiles([a])),
    copyStats(),
  ]);
  const bt = backtest(trades.filter((t) => t.trader === a));
  return {
    address: a,
    name: names.get(a)?.nns ?? null,
    avatar: names.get(a)?.avatar ?? null,
    smart: smart && { label: smart.label, pnl30d: smart.totalPnlUsd, winRate: smart.winRatePct, trades: smart.trades },
    backtest: { roi: bt.roi, pnl: bt.pnl, copied: bt.copied },
    copiers: copy.get(a)?.copiers ?? 0,
  };
}

/** Mirror-token symbol per Kadd pool (lowercase address). Pools never change their token, so cache for an hour. */
const poolSymbols = () =>
  swr("poolSymbols", 60 * 60_000, async () => {
    const pools = await publicClient.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "allPools" });
    const bases = await publicClient.multicall({ allowFailure: false, contracts: pools.map((p) => ({ address: p, abi: kaddPoolAbi, functionName: "baseToken" }) as const) });
    const symbols = await publicClient.multicall({ allowFailure: false, contracts: bases.map((b) => ({ address: b, abi: mirrorTokenAbi, functionName: "symbol" }) as const) });
    return new Map(pools.map((p, i) => [p.toLowerCase(), symbols[i]]));
  });

export type CopyActivity = { id: number; club: boolean; label: string; leader: string; isBuy: boolean; usd: number; symbol: string; tx: string; at: number };

/** Trades the keeper copied into `owner`'s vaults and into copy clubs they joined, newest first. From the cached
 * event history: no extra RPC per call. */
export async function copyActivity(owner: string): Promise<CopyActivity[]> {
  const o = owner.toLowerCase();
  const [logs, symbolOf] = await Promise.all([kaddLogs(), poolSymbols()]);
  if (!logs) return [];
  const leaderOf = new Map(logs.followed.filter((l) => l.args.owner!.toLowerCase() === o).map((l) => [l.args.id!, l.args.leader!.toLowerCase()]));
  const joined = new Set(logs.clubDeposits.filter((l) => l.args.member!.toLowerCase() === o).map((l) => l.args.id!));
  const club = new Map(logs.clubCreated.filter((l) => joined.has(l.args.id!)).map((l) => [l.args.id!, { leader: l.args.leader!.toLowerCase(), name: l.args.name! }]));
  const row = (l: (typeof logs.copied)[number] | (typeof logs.clubCopied)[number], isClub: boolean, leader: string, label: string): CopyActivity => ({
    id: Number(l.args.id!),
    club: isClub,
    label,
    leader,
    isBuy: l.args.isBuy!,
    usd: Number(l.args.isBuy ? l.args.amountIn! : l.args.amountOut!) / 1e6,
    symbol: symbolOf.get(l.args.pool!.toLowerCase()) ?? "?",
    tx: l.transactionHash,
    at: l.timestamp,
  });
  return [
    ...logs.copied.filter((l) => leaderOf.has(l.args.id!)).map((l) => row(l, false, leaderOf.get(l.args.id!)!, `Vault #${l.args.id}`)),
    ...logs.clubCopied.filter((l) => club.has(l.args.id!)).map((l) => row(l, true, club.get(l.args.id!)!.leader, club.get(l.args.id!)!.name)),
  ].sort((a, b) => b.at - a.at);
}

export type CopyBoardRow = { kind: "vault" | "club"; id: number; name: string; leader: string; valueUsd: number; returnPct: number; copies: number; members: number };

/** Every live copy vault and copy club ranked by return. Three batched reads, cached 5 minutes. */
export const copyBoard = () => swr("copyBoard", 5 * 60_000, readCopyBoard);

async function readCopyBoard(): Promise<CopyBoardRow[]> {
  const vaultC = { address: COPY, abi: kaddCopyAbi } as const;
  const clubC = { address: COPY_CLUBS, abi: kaddCopyClubsAbi } as const;
  const live = (a: string) => !/^0x0+$/.test(a);
  const ids = (n: bigint) => Array.from({ length: Number(n) }, (_, i) => BigInt(i));
  const [logs, nVaults, nClubs, pools] = await Promise.all([
    kaddLogs().catch(() => null),
    live(COPY) ? publicClient.readContract({ ...vaultC, functionName: "count" }) : 0n,
    live(COPY_CLUBS) ? publicClient.readContract({ ...clubC, functionName: "count" }) : 0n,
    publicClient.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "allPools" }),
  ]);
  const [vaults, vaultPools, clubs, clubPools, prices] = await Promise.all([
    publicClient.multicall({ allowFailure: false, contracts: ids(nVaults).map((id) => ({ ...vaultC, functionName: "get", args: [id] }) as const) }),
    publicClient.multicall({ allowFailure: false, contracts: ids(nVaults).map((id) => ({ ...vaultC, functionName: "poolsOf", args: [id] }) as const) }),
    publicClient.multicall({ allowFailure: false, contracts: ids(nClubs).map((id) => ({ ...clubC, functionName: "get", args: [id] }) as const) }),
    publicClient.multicall({ allowFailure: false, contracts: ids(nClubs).map((id) => ({ ...clubC, functionName: "poolsOf", args: [id] }) as const) }),
    publicClient.multicall({ allowFailure: false, contracts: pools.map((p) => ({ address: p, abi: kaddPoolAbi, functionName: "price" }) as const) }),
  ]);
  const priceOf = new Map(pools.map((p, i) => [p.toLowerCase(), Number(prices[i]) / 1e6]));
  const pairs = [
    ...vaultPools.flatMap((ps, i) => ps.map((pool) => ({ ...vaultC, kind: "vault", id: BigInt(i), pool }))),
    ...clubPools.flatMap((ps, i) => ps.map((pool) => ({ ...clubC, kind: "club", id: BigInt(i), pool }))),
  ];
  const held = await publicClient.multicall({ allowFailure: false, contracts: pairs.map((p) => ({ address: p.address, abi: kaddCopyAbi, functionName: "held", args: [p.id, p.pool] }) as const) });
  const tokensUsd = (kind: string, id: number) =>
    pairs.reduce((s, p, j) => (p.kind === kind && p.id === BigInt(id) ? s + (Number(held[j]) / 1e18) * (priceOf.get(p.pool.toLowerCase()) ?? 0) : s), 0);
  const count = <T extends { args: { id?: bigint } }>(xs: T[] | undefined, id: number) => xs?.filter((l) => l.args.id === BigInt(id)).length ?? 0;

  const rows: CopyBoardRow[] = [];
  vaults.forEach((v, id) => {
    if (!v.active || !logs) return; // return needs the deposit history
    const deposited = Number(logs.followed.find((l) => l.args.id === BigInt(id))?.args.deposit ?? 0n) + logs.funded.filter((l) => l.args.id === BigInt(id)).reduce((s, l) => s + Number(l.args.amount!), 0);
    if (!deposited) return;
    const valueUsd = Number(v.cash) / 1e6 + tokensUsd("vault", id);
    rows.push({ kind: "vault", id, name: `Vault #${id}`, leader: v.leader.toLowerCase(), valueUsd, returnPct: (valueUsd / (deposited / 1e6) - 1) * 100, copies: count(logs.copied, id), members: 1 });
  });
  clubs.forEach((c, id) => {
    if (c.totalShares === 0n) return;
    // Members join at cash per share and the first deposit mints 1:1, so value per share is the club's return.
    const valueUsd = Number(c.cash) / 1e6 + tokensUsd("club", id);
    const shares = new Map<string, bigint>();
    for (const l of logs?.clubDeposits ?? []) if (l.args.id === BigInt(id)) shares.set(l.args.member!.toLowerCase(), (shares.get(l.args.member!.toLowerCase()) ?? 0n) + l.args.shares!);
    for (const l of logs?.clubRedeemed ?? []) if (l.args.id === BigInt(id)) shares.set(l.args.member!.toLowerCase(), (shares.get(l.args.member!.toLowerCase()) ?? 0n) - l.args.shares!);
    rows.push({ kind: "club", id, name: c.name, leader: c.leader.toLowerCase(), valueUsd, returnPct: (valueUsd / (Number(c.totalShares) / 1e6) - 1) * 100, copies: count(logs?.clubCopied, id), members: [...shares.values()].filter((x) => x > 0n).length || 1 });
  });
  return rows.sort((a, b) => b.returnPct - a.returnPct);
}

export type VaultView = {
  id: number;
  owner: string;
  leader: string;
  leaderName: string | null;
  active: boolean;
  perTradeUsd: number;
  dailyCapUsd: number;
  copySells: boolean;
  depositedUsd: number;
  cashUsd: number;
  positions: { symbol: string; amount: number; usd: number }[];
  valueUsd: number;
  pnlUsd: number;
  pnlPct: number;
  copies: { isBuy: boolean; usd: number; symbol: string; tx: string; at: number }[];
};

/** A copy vault's public view: rules, value now vs money put in, and every trade it copied. Null if it doesn't exist. */
export async function vaultView(id: number): Promise<VaultView | null> {
  if (/^0x0+$/.test(COPY) || !Number.isInteger(id) || id < 0) return null;
  const c = { address: COPY, abi: kaddCopyAbi } as const;
  const count = await publicClient.readContract({ ...c, functionName: "count" });
  if (BigInt(id) >= count) return null;
  const [f, pools, logs] = await Promise.all([
    publicClient.readContract({ ...c, functionName: "get", args: [BigInt(id)] }),
    publicClient.readContract({ ...c, functionName: "poolsOf", args: [BigInt(id)] }),
    kaddLogs().catch(() => null),
  ]);
  const [meta, symbolOf] = await Promise.all([
    pools.length
      ? publicClient.multicall({
          allowFailure: false,
          contracts: pools.flatMap((p) => [
            { ...c, functionName: "held", args: [BigInt(id), p] },
            { address: p, abi: kaddPoolAbi, functionName: "price" },
          ] as const),
        })
      : [],
    poolSymbols(),
  ]);
  const positions = pools
    .map((p, i) => {
      const amount = Number(formatUnits(meta[i * 2], 18));
      return { symbol: symbolOf.get(p.toLowerCase()) ?? "?", amount, usd: amount * (Number(meta[i * 2 + 1]) / 1e6) };
    })
    .filter((x) => x.amount > 0);

  const big = BigInt(id);
  const followed = logs?.followed.find((l) => l.args.id === big);
  const deposited = (followed ? Number(followed.args.deposit!) : 0) + (logs?.funded.filter((l) => l.args.id === big).reduce((s, l) => s + Number(l.args.amount!), 0) ?? 0);
  const copies = (logs ? await copyActivity(f.owner) : []).filter((x) => !x.club && x.id === id);
  const cash = Number(f.cash) / 1e6;
  const depositedUsd = deposited / 1e6;
  const valueUsd = cash + positions.reduce((s, x) => s + x.usd, 0);
  const leader = f.leader.toLowerCase();
  const names = await swr(`nns:${leader}`, 10 * 60_000, () => profiles([leader]));
  return {
    id,
    owner: f.owner.toLowerCase(),
    leader,
    leaderName: names.get(leader)?.nns ?? null,
    active: f.active,
    perTradeUsd: Number(f.perTrade) / 1e6,
    dailyCapUsd: Number(f.dailyCap) / 1e6,
    copySells: f.copySells,
    depositedUsd,
    cashUsd: cash,
    positions,
    valueUsd,
    pnlUsd: valueUsd - depositedUsd,
    pnlPct: depositedUsd ? ((valueUsd - depositedUsd) / depositedUsd) * 100 : 0,
    copies,
  };
}
