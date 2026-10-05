"use client";
// Auto copy trading on KaddCopy (contracts/src/testnet/KaddCopy.sol): a tUSDC vault that the keeper (/api/copy/keeper)
// trades whenever the followed mainnet wallet trades a token Kadd mirrors. Limits live in the contract; the owner can
// stop at any time and gets the tUSDC and tokens back.
import { formatUnits, parseUnits, zeroAddress, type Address } from "viem";
import { kaddCopyAbi } from "./abi";
import { COPY } from "./addresses";
import { refreshChain, requireAccount, toast } from "./store";
import { TUSDC, USDC_DECIMALS, approveIfNeeded, listMarkets, send, tokenBalance, txError, type Market } from "./venue";
import { publicClient } from "./wallet";

export const COPY_READY = COPY !== zeroAddress;

export type CopyView = {
  id: bigint;
  leader: string;
  perTrade: number;
  dailyCap: number;
  cash: number;
  spentToday: number;
  copySells: boolean;
  active: boolean;
  since: number; // unix seconds
  positions: { market: Market; amount: number; value: number }[];
  value: number; // cash + positions at pool prices
};

const usdc = (n: number) => parseUnits(n.toFixed(6), USDC_DECIMALS);
const num = (v: bigint) => Number(formatUnits(v, USDC_DECIMALS));

export async function startCopy(leader: string, c: { perTrade: number; dailyCap: number; deposit: number; copySells: boolean }): Promise<boolean> {
  if (!COPY_READY) return toast("Auto copy isn't deployed yet.", "err"), false;
  const me = await requireAccount().catch((e) => (toast(txError(e), "err"), null));
  if (!me) return false;
  try {
    const deposit = usdc(c.deposit);
    if ((await tokenBalance(TUSDC, me)) < deposit) throw new Error("Not enough tUSDC for this deposit. Claim free test USDC in Portfolio first.");
    await approveIfNeeded(TUSDC, COPY, deposit);
    await send({ address: COPY, abi: kaddCopyAbi, functionName: "follow", args: [leader as Address, usdc(c.perTrade), usdc(c.dailyCap), c.copySells, deposit] });
    refreshChain();
    toast("Auto copy is on. New trades by this wallet are copied within a few minutes.");
    return true;
  } catch (e) {
    toast(txError(e), "err");
    return false;
  }
}

export async function stopCopy(id: bigint): Promise<boolean> {
  if (!(await requireAccount().catch(() => null))) return false;
  try {
    await send({ address: COPY, abi: kaddCopyAbi, functionName: "close", args: [id] });
    refreshChain();
    toast("Auto copy stopped. Your tUSDC and tokens are back in your wallet.");
    return true;
  } catch (e) {
    toast(txError(e), "err");
    return false;
  }
}

export async function copiesOf(owner: Address): Promise<CopyView[]> {
  if (!COPY_READY) return [];
  const ids = await publicClient.readContract({ address: COPY, abi: kaddCopyAbi, functionName: "idsOf", args: [owner] });
  if (!ids.length) return [];
  const c = { address: COPY, abi: kaddCopyAbi } as const;
  const [rows, pools, markets] = await Promise.all([
    publicClient.multicall({ allowFailure: false, contracts: ids.map((id) => ({ ...c, functionName: "get", args: [id] }) as const) }),
    publicClient.multicall({ allowFailure: false, contracts: ids.map((id) => ({ ...c, functionName: "poolsOf", args: [id] }) as const) }),
    listMarkets(),
  ]);
  const pairs = ids.flatMap((id, i) => pools[i].map((pool) => ({ id, pool })));
  const held = pairs.length
    ? await publicClient.multicall({ allowFailure: false, contracts: pairs.map((p) => ({ ...c, functionName: "held", args: [p.id, p.pool] }) as const) })
    : [];
  return ids
    .map((id, i) => {
      const f = rows[i];
      const positions = pairs
        .map((p, j) => ({ ...p, amount: held[j] }))
        .filter((p) => p.id === id && p.amount > 0n)
        .flatMap((p) => {
          const market = markets.find((m) => m.address.toLowerCase() === p.pool.toLowerCase());
          if (!market) return [];
          const amount = Number(formatUnits(p.amount, market.decimals));
          return [{ market, amount, value: amount * market.price }];
        });
      const cash = num(f.cash);
      return {
        id,
        leader: f.leader.toLowerCase(),
        perTrade: num(f.perTrade),
        dailyCap: num(f.dailyCap),
        cash,
        spentToday: num(f.spentToday),
        copySells: f.copySells,
        active: f.active,
        since: Number(f.since),
        positions,
        value: cash + positions.reduce((s, p) => s + p.value, 0),
      };
    })
    .reverse(); // newest first
}
