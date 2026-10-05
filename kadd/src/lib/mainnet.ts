"use client";
// Live trading on Monad mainnet through Kuru Flow (quotes + transactions from /api/kuru/quote), signed by the user's
// passkey session. Real funds: every swap is quoted fresh right before it's sent, with a minimum output.
import { createPublicClient, erc20Abi, formatUnits, http, type Address, type Hex } from "viem";
import { monad } from "viem/chains";
import { mainnetWalletClient } from "./wallet";
import { toast, requireAccount } from "./store";
import { txError } from "./venue";

export const MON = "0x0000000000000000000000000000000000000000";
export const SCAN = "https://monadscan.com";
export const mainnetPublic = createPublicClient({ chain: monad, transport: http(), batch: { multicall: true } });

export type KuruQuote = { output: string; minOut: string; to: Address; data: Hex; value: string };

export async function quoteKuru(user: string, tokenIn: string, tokenOut: string, amount: bigint): Promise<KuruQuote> {
  const r = await fetch("/api/kuru/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user, tokenIn, tokenOut, amount: amount.toString() }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "No route found");
  return j;
}

export async function mainnetBalances(user: Address, token: Address) {
  const [mon, bal, decimals] = await Promise.all([
    mainnetPublic.getBalance({ address: user }),
    mainnetPublic.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [user] }),
    mainnetPublic.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
  ]);
  return { mon, token: bal, decimals };
}

/** Buys `token` with MON or sells it for MON on mainnet via Kuru. Returns the tx hash, or null on failure. */
export async function swapOnKuru(side: "buy" | "sell", token: Address, amountIn: bigint, symbol: string, decimals: number): Promise<Hex | null> {
  const me = await requireAccount().catch((e) => (toast(txError(e), "err"), null));
  if (!me) return null;
  try {
    const wallet = mainnetWalletClient();
    const [tokenIn, tokenOut] = side === "buy" ? [MON, token] : [token, MON];
    if (side === "sell") {
      // Approve exactly this sale for Kuru's router (the router address comes from the quote).
      const probe = await quoteKuru(me, tokenIn, tokenOut, amountIn);
      const allowance = await mainnetPublic.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [me, probe.to] });
      if (allowance < amountIn) {
        toast(`Approving ${symbol} for Kuru…`);
        const h = await wallet.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [probe.to, amountIn] });
        await mainnetPublic.waitForTransactionReceipt({ hash: h });
      }
    }
    const q = await quoteKuru(me, tokenIn, tokenOut, amountIn); // fresh quote right before sending
    const hash = await wallet.sendTransaction({ to: q.to, data: q.data, value: BigInt(q.value) });
    const receipt = await mainnetPublic.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Swap reverted onchain (price moved past the minimum).");
    const got = Number(formatUnits(BigInt(q.output), side === "buy" ? decimals : 18)).toLocaleString("en-US", { maximumSignificantDigits: 4 });
    const out = side === "buy" ? `${got} ${symbol}` : `${got} MON`;
    toast(`Swapped on Monad mainnet via Kuru: ~${out}`);
    return hash;
  } catch (e) {
    toast(txError(e), "err");
    return null;
  }
}
