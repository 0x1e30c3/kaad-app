"use client";
// Terminal trading on Monad testnet: every Buy/Sell is a real transaction on the token's mirror pool (venue.ts).
// One click covers the whole path: open the pool if nobody has, top up from the tUSDC faucet if short, approve,
// swap. The Mera session signs each step without extra prompts.
import { useEffect, useState } from "react";
import { erc20Abi, formatUnits, parseUnits, type Address } from "viem";
import type { TokenRef } from "./market";
import { recordFill, ref, refreshChain, requireAccount, toast, useStore } from "./store";
import { TUSDC, USDC_DECIMALS, VENUE_READY, claimFaucet, faucetWait, listMarkets, marketFor, openMirror, swap, tokenBalance, txError, type Market } from "./venue";
import { publicClient } from "./wallet";

const FAUCET = 1_000n * 10n ** 6n;
const fmt = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 4 });

/** Buys `usd` tUSDC worth of a mainnet token's testnet mirror. Returns true when the swap confirmed. */
export async function buyToken(t: TokenRef & { price: number }, usd: number): Promise<boolean> {
  if (!VENUE_READY) return toast("Testnet trading isn't configured yet.", "err"), false;
  if (!(usd > 0)) return toast("Enter an amount first", "err"), false;
  const me = await requireAccount().catch((e) => (toast(txError(e), "err"), null));
  if (!me) return false;
  try {
    const amountIn = parseUnits(usd.toFixed(6), USDC_DECIMALS);
    if (amountIn > FAUCET * 10n) throw new Error("Max 10,000 tUSDC per trade on testnet.");
    let balance = await tokenBalance(TUSDC, me);
    if (balance < amountIn) {
      const wait = await faucetWait(me);
      if (wait > 0 || balance + FAUCET < amountIn)
        throw new Error(`Not enough tUSDC (you have ${fmt(Number(formatUnits(balance, 6)))}).${wait > 0 ? ` Faucet refills in ${Math.ceil(wait / 60)} min.` : ""}`);
      toast("Claiming 1,000 free test USDC…");
      await claimFaucet();
      balance += FAUCET;
    }
    let market = await marketFor(t.address);
    if (!market) {
      toast(`Opening a testnet pool for ${t.symbol} at the mainnet price…`);
      market = await openMirror(t);
    }
    const { hash, out } = await swap(market, true, amountIn);
    const amount = Number(formatUnits(out, market.decimals));
    recordFill({ ...ref(t), side: "buy", usd, amount, at: Date.now(), hash });
    toast(`Bought ${fmt(amount)} ${t.symbol} for ${usd} tUSDC`);
    return true;
  } catch (e) {
    toast(txError(e), "err");
    return false;
  }
}

/** Sells `pct`% of the wallet's mirror tokens back to tUSDC. */
export async function sellToken(t: TokenRef, pct: number): Promise<boolean> {
  if (!VENUE_READY) return toast("Testnet trading isn't configured yet.", "err"), false;
  const me = await requireAccount().catch((e) => (toast(txError(e), "err"), null));
  if (!me) return false;
  try {
    const market = await marketFor(t.address);
    const held = market ? await tokenBalance(market.base, me) : 0n;
    const amountIn = (held * BigInt(Math.round(Math.min(pct, 100) * 100))) / 10_000n;
    if (!market || amountIn === 0n) throw new Error(`You don't hold any ${t.symbol}.`);
    const { hash, out } = await swap(market, false, amountIn);
    const usd = Number(formatUnits(out, USDC_DECIMALS));
    recordFill({ ...ref(t), side: "sell", usd, amount: Number(formatUnits(amountIn, market.decimals)), at: Date.now(), hash }, Number(amountIn) / Number(held));
    toast(`Sold ${Math.round(pct)}% of ${t.symbol} for ${fmt(usd)} tUSDC`);
    return true;
  } catch (e) {
    toast(txError(e), "err");
    return false;
  }
}

export async function faucet(): Promise<boolean> {
  const me = await requireAccount().catch((e) => (toast(txError(e), "err"), null));
  if (!me) return false;
  try {
    await claimFaucet();
    refreshChain();
    toast("Claimed 1,000 free test USDC");
    return true;
  } catch (e) {
    toast(txError(e), "err");
    return false;
  }
}

export type Holding = { market: Market; amount: number; value: number };
export type Wallet = { usdc: number; holdings: Holding[] };

/** tUSDC + every mirror token the signed-in wallet holds, re-read after each transaction. */
export function useWallet(): Wallet | null {
  const { user, rev } = useStore();
  const [wallet, setWallet] = useState<{ key: string; data: Wallet } | null>(null);
  const key = `${user?.address}:${rev}`;
  useEffect(() => {
    if (!user || !VENUE_READY) return;
    let live = true;
    const load = () => readWallet(user.address).then((data) => live && setWallet({ key, data }), () => {});
    load();
    const id = setInterval(load, 20_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [user, key]);
  return user && wallet?.key.startsWith(`${user.address}:`) ? wallet.data : null;
}

async function readWallet(owner: Address): Promise<Wallet> {
  const markets = await listMarkets();
  const balances = await publicClient.multicall({
    allowFailure: false,
    contracts: [TUSDC, ...markets.map((m) => m.base)].map((token) => ({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] }) as const),
  });
  const [usdc, ...rest] = balances;
  const holdings = markets
    .map((market, i) => {
      const amount = Number(formatUnits(rest[i], market.decimals));
      return { market, amount, value: amount * market.price };
    })
    .filter((h) => h.amount > 0);
  return { usdc: Number(formatUnits(usdc, USDC_DECIMALS)), holdings };
}
