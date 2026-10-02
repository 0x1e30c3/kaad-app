"use client";
// Wallet security: which Kadd contracts may move this wallet's tokens, and revoking that. Allowances are read
// directly for every known (token, spender) pair, so nothing depends on scanning logs.
import { erc20Abi, zeroAddress, type Address } from "viem";
import { STRATEGIES } from "./addresses";
import { listClubs } from "./club";
import { TUSDC, listMarkets, send } from "./venue";
import { publicClient } from "./wallet";

export type Approval = { token: Address; symbol: string; spender: Address; spenderLabel: string; amount: bigint };

export async function approvalsOf(owner: Address): Promise<Approval[]> {
  const [markets, clubs] = await Promise.all([listMarkets(), listClubs().catch(() => [])]);
  const strategies = STRATEGIES !== zeroAddress ? [{ spender: STRATEGIES, spenderLabel: "Strategies (limit / TP / SL / DCA)" }] : [];
  const pairs = [
    ...markets.map((m) => ({ token: TUSDC, symbol: "tUSDC", spender: m.address, spenderLabel: `${m.symbol} pool` })),
    ...clubs.map((c) => ({ token: TUSDC, symbol: "tUSDC", spender: c.address, spenderLabel: `Club "${c.name}"` })),
    ...strategies.map((x) => ({ token: TUSDC, symbol: "tUSDC", ...x })),
    ...markets.flatMap((m) => [
      { token: m.base, symbol: m.symbol, spender: m.address, spenderLabel: `${m.symbol} pool` },
      ...strategies.map((x) => ({ token: m.base, symbol: m.symbol, ...x })),
    ]),
  ];
  if (!pairs.length) return [];
  const amounts = await publicClient.multicall({
    allowFailure: false,
    contracts: pairs.map((p) => ({ address: p.token, abi: erc20Abi, functionName: "allowance", args: [owner, p.spender] }) as const),
  });
  return pairs.map((p, i) => ({ ...p, amount: amounts[i] })).filter((a) => a.amount > 0n);
}

export const revoke = (a: Approval) => send({ address: a.token, abi: erc20Abi, functionName: "approve", args: [a.spender, 0n] });
