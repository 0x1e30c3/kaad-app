"use client";
// Copy clubs on KaddCopyClubs (contracts/src/testnet/KaddCopyClubs.sol): friends pool tUSDC into one vault that the
// keeper (/api/copy/keeper) trades whenever the leader trades. Deposits only while the club holds no tokens; exit in
// kind anytime.
import { formatUnits, parseEventLogs, parseUnits, zeroAddress, type Address } from "viem";
import { kaddCopyClubsAbi } from "./abi";
import { COPY_CLUBS } from "./addresses";
import { refreshChain, requireAccount, toast } from "./store";
import { TUSDC, USDC_DECIMALS, approveIfNeeded, listMarkets, send, tokenBalance, txError } from "./venue";
import { publicClient } from "./wallet";

export const COPY_CLUBS_READY = COPY_CLUBS !== zeroAddress;
const c = { address: COPY_CLUBS, abi: kaddCopyClubsAbi } as const;
const num = (v: bigint) => Number(formatUnits(v, USDC_DECIMALS));

export type CopyClubView = {
  id: bigint;
  name: string;
  creator: string;
  leader: string;
  perTradePct: number;
  dailyCapPct: number;
  copySells: boolean;
  flat: boolean;
  cash: number;
  value: number; // cash + positions at pool prices
  positions: { symbol: string; value: number }[];
  totalShares: bigint;
  myShares: bigint;
};

/** Every copy club, newest first, with my shares when signed in. */
export async function listCopyClubs(me?: Address): Promise<CopyClubView[]> {
  if (!COPY_CLUBS_READY) return [];
  const count = await publicClient.readContract({ ...c, functionName: "count" });
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i)).reverse();
  if (!ids.length) return [];
  const [rows, pools, mine, markets] = await Promise.all([
    publicClient.multicall({ allowFailure: false, contracts: ids.map((id) => ({ ...c, functionName: "get", args: [id] }) as const) }),
    publicClient.multicall({ allowFailure: false, contracts: ids.map((id) => ({ ...c, functionName: "poolsOf", args: [id] }) as const) }),
    me ? publicClient.multicall({ allowFailure: false, contracts: ids.map((id) => ({ ...c, functionName: "sharesOf", args: [id, me] }) as const) }) : null,
    listMarkets(),
  ]);
  const pairs = ids.flatMap((id, i) => pools[i].map((pool) => ({ id, pool })));
  const held = pairs.length ? await publicClient.multicall({ allowFailure: false, contracts: pairs.map((p) => ({ ...c, functionName: "held", args: [p.id, p.pool] }) as const) }) : [];
  return ids.map((id, i) => {
    const r = rows[i];
    const positions = pairs.flatMap((p, j) => {
      const m = p.id === id && held[j] > 0n ? markets.find((x) => x.address.toLowerCase() === p.pool.toLowerCase()) : undefined;
      return m ? [{ symbol: m.symbol, value: Number(formatUnits(held[j], m.decimals)) * m.price }] : [];
    });
    const cash = num(r.cash);
    return {
      id,
      name: r.name,
      creator: r.creator.toLowerCase(),
      leader: r.leader.toLowerCase(),
      perTradePct: r.perTradeBps / 100,
      dailyCapPct: r.dailyCapBps / 100,
      copySells: r.copySells,
      flat: r.holding === 0,
      cash,
      value: cash + positions.reduce((s, p) => s + p.value, 0),
      positions,
      totalShares: r.totalShares,
      myShares: mine?.[i] ?? 0n,
    };
  });
}

async function account() {
  const me = await requireAccount();
  if (!me) throw new Error("Sign in to continue.");
  return me;
}

async function pay(amount: number) {
  const me = await account();
  const atoms = parseUnits(amount.toFixed(6), USDC_DECIMALS);
  if ((await tokenBalance(TUSDC, me)) < atoms) throw new Error("Not enough tUSDC. Claim free test USDC in Portfolio first.");
  await approveIfNeeded(TUSDC, COPY_CLUBS, atoms);
  return atoms;
}

/** Creates a club and makes the first deposit (two transactions, signed without prompts). Returns its id. */
export async function startCopyClub(r: { name: string; leader: string; perTradePct: number; dailyCapPct: number; copySells: boolean; deposit: number }): Promise<bigint | null> {
  if (!COPY_CLUBS_READY) return toast("Copy clubs aren't deployed yet.", "err"), null;
  try {
    const atoms = await pay(r.deposit);
    const receipt = await send({ ...c, functionName: "create", args: [r.name, r.leader as Address, Math.round(r.perTradePct * 100), Math.round(r.dailyCapPct * 100), r.copySells] });
    const [log] = parseEventLogs({ abi: kaddCopyClubsAbi, eventName: "ClubCreated", logs: receipt.logs });
    await send({ ...c, functionName: "deposit", args: [log.args.id, atoms] });
    refreshChain();
    toast(`Copy club "${r.name}" is live. Share it so friends can join while it's flat.`);
    return log.args.id;
  } catch (e) {
    toast(txError(e), "err");
    return null;
  }
}

export async function joinCopyClub(id: bigint, amount: number): Promise<boolean> {
  try {
    const atoms = await pay(amount);
    await send({ ...c, functionName: "deposit", args: [id, atoms] });
    refreshChain();
    toast("Deposited. The club copies its leader's next trade with your share in it.");
    return true;
  } catch (e) {
    toast(txError(e), "err");
    return false;
  }
}

/** Withdraws all my shares in kind: my part of the cash and of every token the club holds. */
export async function leaveCopyClub(id: bigint, shares: bigint): Promise<boolean> {
  try {
    await account();
    await send({ ...c, functionName: "redeem", args: [id, shares] });
    refreshChain();
    toast("Withdrawn: your tUSDC and tokens are back in your wallet.");
    return true;
  } catch (e) {
    toast(txError(e), "err");
    return false;
  }
}
