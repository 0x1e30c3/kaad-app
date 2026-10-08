// Copy-trading keeper: turns new Monad mainnet trades by followed wallets into copyBuy / copySell calls on testnet, for
// KaddCopy vaults and KaddCopyClubs clubs alike (same keeper interface). The contract enforces every limit and copies each leader trade once, so running this too often or from
// several places is harmless; it just finds nothing to do.
import "server-only";
import { BaseError, ContractFunctionRevertedError, createWalletClient, encodeAbiParameters, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { kaddCopyAbi, kaddCopyClubsAbi, kaddPoolAbi, kaddVenueAbi } from "./abi";
import { COPY, COPY_CLUBS, VENUE } from "./addresses";
import { chain, publicClient, transport } from "./chain";
import { recentTrades, type WalletTrade } from "./wallets";

const MAX_PER_RUN = 20; // ponytail: bounded run; a backlog drains over the next runs
const SLIPPAGE_BPS = 300n; // the keeper's own guard on top of the contract's limits

export type Kind = "copy" | "club";
type Follow = { kind: Kind; id: bigint; leader: string; since: number; copySells: boolean };
export type Plan = { kind: Kind; id: bigint; isBuy: boolean; source: Address; tx: Hex; at: number };

/** Leader trades each active follow should copy, oldest first: only trades after the follow started. */
export function plan(follows: Follow[], trades: WalletTrade[]): Plan[] {
  const out: Plan[] = [];
  for (const f of follows)
    for (const t of trades)
      if (t.trader === f.leader && t.at >= f.since * 1000 && (t.side === "buy" || f.copySells))
        out.push({ kind: f.kind, id: f.id, isBuy: t.side === "buy", source: t.token.address as Address, tx: t.tx as Hex, at: t.at });
  return out.sort((a, b) => a.at - b.at);
}

/** The key KaddCopy uses for "already copied": keccak(abi.encode(leaderTx, source)). */
export const copyKey = (tx: Hex, source: Address) => keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "address" }], [tx, source]));

let running: Promise<KeeperResult> | null = null;
let lastRun = 0;
export type KeeperResult = { ran: boolean; reason?: string; copied: number; skipped: number; errors: string[] };

/** Runs at most once per 20s per server instance; concurrent callers share the run. */
export function runKeeper(): Promise<KeeperResult> {
  if (running) return running;
  if (Date.now() - lastRun < 20_000) return Promise.resolve({ ran: false, reason: "ran recently", copied: 0, skipped: 0, errors: [] });
  lastRun = Date.now();
  return (running = keep().finally(() => (running = null)));
}

const zero = (a: Address) => /^0x0+$/.test(a);
// Both contracts expose the same keeper interface (copyBuy, copySell, copied, held), so one ABI type serves both.
const contractOf = (kind: Kind) => (kind === "copy" ? { address: COPY, abi: kaddCopyAbi } : { address: COPY_CLUBS, abi: kaddCopyClubsAbi as unknown as typeof kaddCopyAbi });
type Vault = Follow & { cash: bigint; buy: (cash: bigint) => bigint };

/** Every vault the keeper should serve: active KaddCopy follows, and clubs that have members. */
async function vaults(): Promise<Vault[]> {
  const ids = (n: bigint) => Array.from({ length: Number(n) }, (_, i) => BigInt(i));
  // ponytail: reads every vault each run; page by id range (or index events) past a few hundred.
  const [follows, clubs] = await Promise.all([
    zero(COPY)
      ? []
      : publicClient.readContract({ address: COPY, abi: kaddCopyAbi, functionName: "count" }).then(async (n) => {
          const rows = await publicClient.multicall({ allowFailure: false, contracts: ids(n).map((id) => ({ address: COPY, abi: kaddCopyAbi, functionName: "get", args: [id] }) as const) });
          return rows.flatMap((f, i) =>
            f.active ? [{ kind: "copy" as const, id: BigInt(i), leader: f.leader.toLowerCase(), since: Number(f.since), copySells: f.copySells, cash: f.cash as bigint, buy: (cash: bigint) => (f.perTrade < cash ? f.perTrade : cash) }] : [],
          );
        }),
    zero(COPY_CLUBS)
      ? []
      : publicClient.readContract({ address: COPY_CLUBS, abi: kaddCopyClubsAbi, functionName: "count" }).then(async (n) => {
          const rows = await publicClient.multicall({ allowFailure: false, contracts: ids(n).map((id) => ({ address: COPY_CLUBS, abi: kaddCopyClubsAbi, functionName: "get", args: [id] }) as const) });
          return rows.flatMap((c, i) =>
            c.totalShares > 0n ? [{ kind: "club" as const, id: BigInt(i), leader: c.leader.toLowerCase(), since: Number(c.since), copySells: c.copySells, cash: c.cash as bigint, buy: (cash: bigint) => (cash * BigInt(c.perTradeBps)) / 10_000n }] : [],
          );
        }),
  ]);
  return [...follows, ...clubs];
}

/** One keeper pass. `getTrades` is injectable so a fork test can feed it synthetic leader trades. */
export async function keep(getTrades: () => Promise<{ trades: WalletTrade[] }> = recentTrades): Promise<KeeperResult> {
  const key = (process.env.KEEPER_PRIVATE_KEY || process.env.DRIP_PRIVATE_KEY) as Hex | undefined;
  if (!key || (zero(COPY) && zero(COPY_CLUBS))) return { ran: false, reason: "keeper not configured", copied: 0, skipped: 0, errors: [] };
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: transport() });

  const all = await vaults();
  if (!all.length) return { ran: true, copied: 0, skipped: 0, errors: [] };
  const { trades } = await getTrades();
  const todo = plan(all, trades);
  if (!todo.length) return { ran: true, copied: 0, skipped: 0, errors: [] };
  const done = await publicClient.multicall({
    allowFailure: false,
    contracts: todo.map((p) => ({ ...contractOf(p.kind), functionName: "copied", args: [p.id, copyKey(p.tx, p.source)] }) as const),
  });
  const fresh = todo.filter((_, i) => !done[i]).slice(0, MAX_PER_RUN);

  let copied = 0;
  let skipped = todo.length - fresh.length;
  const errors: string[] = [];
  for (const p of fresh) {
    const v = all.find((x) => x.kind === p.kind && x.id === p.id)!;
    const c = contractOf(p.kind);
    // A vault with no cash left can't buy: skip before spending any RPC request on it.
    if (p.isBuy && v.buy(v.cash) === 0n) {
      skipped++;
      continue;
    }
    try {
      const pool = await publicClient.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "poolOf", args: [p.source] });
      const amountIn = p.isBuy ? v.buy(v.cash) : await publicClient.readContract({ ...c, functionName: "held", args: [p.id, pool] });
      if (amountIn === 0n) {
        skipped++;
        continue;
      }
      const quoted = await publicClient.readContract({ address: pool, abi: kaddPoolAbi, functionName: "quote", args: [p.isBuy, amountIn] });
      const minOut = (quoted * (10_000n - SLIPPAGE_BPS)) / 10_000n;
      // Simulate first: a vault over its daily cap, or with nothing to sell, is skipped without spending gas.
      const { request } = await publicClient.simulateContract({ ...c, account, functionName: p.isBuy ? "copyBuy" : "copySell", args: [p.id, p.source, p.tx, minOut] });
      const hash = await wallet.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      if (p.isBuy) v.cash -= amountIn;
      copied++;
    } catch (e) {
      skipped++;
      const revert = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
      const why = revert instanceof ContractFunctionRevertedError && revert.data?.errorName ? revert.data.errorName : (e as Error).message.split("\n")[0];
      errors.push(`${p.kind === "club" ? "club " : ""}#${p.id} ${p.isBuy ? "buy" : "sell"} ${p.source.slice(0, 8)}: ${why}`);
    }
  }
  return { ran: true, copied, skipped, errors };
}
