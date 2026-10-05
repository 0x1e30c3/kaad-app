// Copy-trading keeper: turns new Monad mainnet trades by followed wallets into KaddCopy.copyBuy / copySell calls on
// testnet. The contract enforces every limit and copies each leader trade once, so running this too often or from
// several places is harmless; it just finds nothing to do.
import "server-only";
import { BaseError, ContractFunctionRevertedError, createWalletClient, encodeAbiParameters, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { kaddCopyAbi, kaddPoolAbi, kaddVenueAbi } from "./abi";
import { COPY, VENUE } from "./addresses";
import { chain, publicClient, transport } from "./chain";
import { recentTrades, type WalletTrade } from "./wallets";

const MAX_PER_RUN = 20; // ponytail: bounded run; a backlog drains over the next runs
const SLIPPAGE_BPS = 300n; // the keeper's own guard on top of the contract's limits

type Follow = { id: bigint; leader: string; since: number; copySells: boolean };
export type Plan = { id: bigint; isBuy: boolean; source: Address; tx: Hex; at: number };

/** Leader trades each active follow should copy, oldest first: only trades after the follow started. */
export function plan(follows: Follow[], trades: WalletTrade[]): Plan[] {
  const out: Plan[] = [];
  for (const f of follows)
    for (const t of trades)
      if (t.trader === f.leader && t.at >= f.since * 1000 && (t.side === "buy" || f.copySells))
        out.push({ id: f.id, isBuy: t.side === "buy", source: t.token.address as Address, tx: t.tx as Hex, at: t.at });
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

/** One keeper pass. `getTrades` is injectable so a fork test can feed it synthetic leader trades. */
export async function keep(getTrades: () => Promise<{ trades: WalletTrade[] }> = recentTrades): Promise<KeeperResult> {
  const key = (process.env.KEEPER_PRIVATE_KEY || process.env.DRIP_PRIVATE_KEY) as Hex | undefined;
  if (!key || /^0x0+$/.test(COPY)) return { ran: false, reason: "keeper not configured", copied: 0, skipped: 0, errors: [] };
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: transport() });
  const c = { address: COPY, abi: kaddCopyAbi } as const;

  const count = await publicClient.readContract({ ...c, functionName: "count" });
  if (count === 0n) return { ran: true, copied: 0, skipped: 0, errors: [] };
  // ponytail: reads every follow each run; page by id range (or index Followed events) past a few hundred.
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  const rows = await publicClient.multicall({ allowFailure: false, contracts: ids.map((id) => ({ ...c, functionName: "get", args: [id] }) as const) });
  const follows = rows
    .map((f, i) => ({ id: ids[i], leader: f.leader.toLowerCase(), since: Number(f.since), copySells: f.copySells, active: f.active, perTrade: f.perTrade, cash: f.cash }))
    .filter((f) => f.active);
  if (!follows.length) return { ran: true, copied: 0, skipped: 0, errors: [] };

  const { trades } = await getTrades();
  const todo = plan(follows, trades);
  if (!todo.length) return { ran: true, copied: 0, skipped: 0, errors: [] };
  const done = await publicClient.multicall({
    allowFailure: false,
    contracts: todo.map((p) => ({ ...c, functionName: "copied", args: [p.id, copyKey(p.tx, p.source)] }) as const),
  });
  const fresh = todo.filter((_, i) => !done[i]).slice(0, MAX_PER_RUN);

  let copied = 0;
  let skipped = todo.length - fresh.length;
  const errors: string[] = [];
  for (const p of fresh) {
    const f = follows.find((x) => x.id === p.id)!;
    try {
      const pool = await publicClient.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "poolOf", args: [p.source] });
      let amountIn: bigint;
      if (p.isBuy) amountIn = f.perTrade < f.cash ? f.perTrade : f.cash;
      else amountIn = await publicClient.readContract({ ...c, functionName: "held", args: [p.id, pool] });
      if (amountIn === 0n) {
        skipped++;
        continue;
      }
      const quoted = await publicClient.readContract({ address: pool, abi: kaddPoolAbi, functionName: "quote", args: [p.isBuy, amountIn] });
      const minOut = (quoted * (10_000n - SLIPPAGE_BPS)) / 10_000n;
      // Simulate first: a follow over its daily cap, or with nothing to sell, is skipped without spending gas.
      const { request } = await publicClient.simulateContract({ ...c, account, functionName: p.isBuy ? "copyBuy" : "copySell", args: [p.id, p.source, p.tx, minOut] });
      const hash = await wallet.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      if (p.isBuy) f.cash -= amountIn;
      copied++;
    } catch (e) {
      skipped++;
      const revert = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
      const why = revert instanceof ContractFunctionRevertedError && revert.data?.errorName ? revert.data.errorName : (e as Error).message.split("\n")[0];
      errors.push(`#${p.id} ${p.isBuy ? "buy" : "sell"} ${p.source.slice(0, 8)}: ${why}`);
    }
  }
  return { ran: true, copied, skipped, errors };
}
