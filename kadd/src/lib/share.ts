// Data behind the shareable cards and the public vault page. Reuses the cached reads (mainnet trades, Nansen, NNS,
// Kadd event history); the only fresh read is one multicall for a vault's current state.
import "server-only";
import { formatUnits, type Address } from "viem";
import { kaddCopyAbi, kaddPoolAbi, mirrorTokenAbi } from "./abi";
import { COPY } from "./addresses";
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
  const meta = pools.length
    ? await publicClient.multicall({
        allowFailure: false,
        contracts: pools.flatMap((p) => [
          { ...c, functionName: "held", args: [BigInt(id), p] },
          { address: p, abi: kaddPoolAbi, functionName: "price" },
          { address: p, abi: kaddPoolAbi, functionName: "baseToken" },
        ] as const),
      })
    : [];
  const bases = pools.map((_, i) => meta[i * 3 + 2] as Address);
  const symbols = bases.length ? await publicClient.multicall({ allowFailure: false, contracts: bases.map((b) => ({ address: b, abi: mirrorTokenAbi, functionName: "symbol" }) as const) }) : [];
  const symbolOf = new Map(pools.map((p, i) => [p.toLowerCase(), symbols[i] as string]));
  const positions = pools
    .map((p, i) => {
      const amount = Number(formatUnits(meta[i * 3] as bigint, 18));
      return { symbol: symbols[i] as string, amount, usd: amount * (Number(meta[i * 3 + 1] as bigint) / 1e6) };
    })
    .filter((x) => x.amount > 0);

  const big = BigInt(id);
  const followed = logs?.followed.find((l) => l.args.id === big);
  const deposited = (followed ? Number(followed.args.deposit!) : 0) + (logs?.funded.filter((l) => l.args.id === big).reduce((s, l) => s + Number(l.args.amount!), 0) ?? 0);
  const copies = (logs?.copied ?? [])
    .filter((l) => l.args.id === big)
    .map((l) => ({
      isBuy: l.args.isBuy!,
      usd: Number(l.args.isBuy ? l.args.amountIn! : l.args.amountOut!) / 1e6,
      symbol: symbolOf.get(l.args.pool!.toLowerCase()) ?? "?",
      tx: l.transactionHash,
      at: l.timestamp,
    }))
    .reverse();
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
