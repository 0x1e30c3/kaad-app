"use client";
// The Kadd testnet venue (contracts/src/testnet/KaddVenue.sol): free test dollars (tUSDC), and one constant-product
// "mirror" pool per mainnet token, opened at the mainnet price. Kuru's own testnet books are empty and its tokens
// are admin-mint only, so this is where swaps and clubs actually trade on Monad testnet.
import { BaseError, ContractFunctionRevertedError, erc20Abi, getAddress, parseEventLogs, parseUnits, zeroAddress, type Abi, type Address } from "viem";
import { isMeraError } from "@category-labs/mera";
import { kaddClubAbi, kaddClubFactoryAbi, kaddPoolAbi, kaddVenueAbi, mirrorTokenAbi, testUsdcAbi } from "./abi";
import { passkeyError, publicClient, walletClient } from "./wallet";

import { CLUB_FACTORY, TUSDC, VENUE, VENUE_READY } from "./addresses";
export { CLUB_FACTORY, TUSDC, VENUE, VENUE_READY };

export const USDC_DECIMALS = 6;
export const EXPLORER = "https://testnet.monadexplorer.com";
const SEED_USD = 50_000; // KaddVenue.SEED_QUOTE

/** A mirror pool. `price` = tUSDC per whole token. `dust` ≈ 1 cent of base, so leftovers don't block club deposits. */
export type Market = { address: Address; symbol: string; base: Address; source: Address; decimals: number; price: number; dust: bigint };

const priceOf = (raw: bigint) => Number(raw) / 10 ** USDC_DECIMALS; // pool.price() is tUSDC atoms per 1e18 base atoms
const dustOf = (raw: bigint) => (raw > 0n ? (10_000n * 10n ** 18n) / raw : 0n);

// Many components need the market list at once (header, portfolio, security, strategies). Share one read per 15s
// and one in-flight request, so a page load doesn't trip the public RPC's ~15 requests/second limit.
let marketsCache: { at: number; p: Promise<Market[]> } | null = null;

export function listMarkets(): Promise<Market[]> {
  if (!VENUE_READY) return Promise.resolve([]);
  if (marketsCache && Date.now() - marketsCache.at < 15_000) return marketsCache.p;
  const p = publicClient
    .readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "allPools" })
    .then((pools) => Promise.all(pools.map(readMarket)));
  marketsCache = { at: Date.now(), p };
  p.catch(() => marketsCache?.p === p && (marketsCache = null));
  return p;
}

/** Prices and the pool list changed (swap, new pool): next read goes to chain. */
export const invalidateMarkets = () => (marketsCache = null);

export async function readMarket(pool: Address): Promise<Market> {
  const [base, raw] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { address: pool, abi: kaddPoolAbi, functionName: "baseToken" },
      { address: pool, abi: kaddPoolAbi, functionName: "price" },
    ],
  });
  const [symbol, source] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { address: base, abi: mirrorTokenAbi, functionName: "symbol" },
      { address: base, abi: mirrorTokenAbi, functionName: "source" },
    ],
  });
  return { address: pool, symbol, base, source, decimals: 18, price: priceOf(raw), dust: dustOf(raw) };
}

/** The testnet pool mirroring a mainnet token, or null if nobody opened one yet. */
export async function marketFor(source: string): Promise<Market | null> {
  if (!VENUE_READY) return null;
  const pool = await publicClient.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "poolOf", args: [getAddress(source)] });
  return pool === zeroAddress ? null : readMarket(pool);
}

export async function quote(market: Market, isBuy: boolean, amountIn: bigint) {
  return amountIn > 0n ? publicClient.readContract({ address: market.address, abi: kaddPoolAbi, functionName: "quote", args: [isBuy, amountIn] }) : 0n;
}

export const tokenBalance = (token: Address, owner: Address) => publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });

/** Seconds until the faucet can be claimed again (0 = now). */
export async function faucetWait(owner: Address) {
  const last = await publicClient.readContract({ address: TUSDC, abi: testUsdcAbi, functionName: "lastClaim", args: [owner] });
  return last === 0n ? 0 : Math.max(0, Number(last) + 3600 - Math.floor(Date.now() / 1000));
}

// ------------------------------------------------------------------ writes

const ERRORS_ABI = [...kaddClubAbi, ...kaddClubFactoryAbi, ...kaddVenueAbi, ...kaddPoolAbi, ...testUsdcAbi] as Abi;

/** Simulates first (so reverts come back as readable errors before any gas is spent), then sends and waits. */
export async function send(params: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }) {
  const wc = walletClient();
  const { request } = await publicClient.simulateContract({ ...params, abi: ERRORS_ABI.concat(params.abi), account: wc.account } as never);
  const hash = await wc.writeContract(request as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction failed onchain");
  return receipt;
}

export async function approveIfNeeded(token: Address, spender: Address, amount: bigint) {
  const owner = walletClient().account.address;
  const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
  if (allowance < amount) await send({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, 2n ** 256n - 1n] });
}

export const claimFaucet = () => send({ address: TUSDC, abi: testUsdcAbi, functionName: "faucet" });

/** Opens the testnet pool for a mainnet token at `priceUsd` (SEED_USD of tUSDC against the matching token amount). */
export async function openMirror(t: { address: string; name: string; symbol: string; price: number }) {
  if (!(t.price > 0)) throw new Error("No mainnet price to open a testnet pool at.");
  const baseSeed = parseUnits((SEED_USD / t.price).toFixed(6), 18);
  const receipt = await send({ address: VENUE, abi: kaddVenueAbi, functionName: "createMirror", args: [getAddress(t.address), t.name, t.symbol, baseSeed] });
  const [log] = parseEventLogs({ abi: kaddVenueAbi, eventName: "MirrorCreated", logs: receipt.logs });
  invalidateMarkets();
  return readMarket(log.args.pool);
}

/** Exact-input swap from the wallet. Buys spend tUSDC; sells spend the mirror token. */
export async function swap(market: Market, isBuy: boolean, amountIn: bigint, slippageBps = 100) {
  const out = await quote(market, isBuy, amountIn);
  if (out === 0n) throw new Error("Amount too small.");
  await approveIfNeeded(isBuy ? TUSDC : market.base, market.address, amountIn);
  const minOut = (out * BigInt(10_000 - slippageBps)) / 10_000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 120);
  const receipt = await send({
    address: market.address,
    abi: kaddPoolAbi,
    functionName: "swapExact",
    args: [isBuy, amountIn, minOut, deadline, walletClient().account.address],
  });
  invalidateMarkets();
  return { hash: receipt.transactionHash, out };
}

// ------------------------------------------------------------------ errors

const MESSAGES: Record<string, string> = {
  NotFlat: "Deposits only work while the club holds no positions.",
  NotCaptain: "Only the captain can trade.",
  TradeTooLarge: "Amount exceeds the club's per-trade limit.",
  ZeroShares: "Amount too small.",
  ZeroAmount: "Enter an amount above 0.",
  InsufficientShares: "Not enough shares.",
  MarketNotAllowed: "This market isn't allowed in the club.",
  InvalidConfig: "Invalid club config.",
  Slippage: "Price moved past the slippage limit. Try again.",
  Expired: "The transaction took too long. Try again.",
  TooSoon: "Faucet already claimed. You can claim again within the hour.",
  AlreadyMirrored: "A testnet pool for this token already exists.",
  InvalidSeed: "Couldn't open a testnet pool at this price.",
  Invalid: "Check the settings: amount per trade above 0, daily limit at least one trade, deposit above 0.",
  Inactive: "This copy is already stopped.",
  NotOwner: "Only the owner can do that.",
};

export function txError(e: unknown): string {
  if (isMeraError(e)) return passkeyError(e);
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
    if (name) return MESSAGES[name] ?? `Rejected by contract: ${name}`;
    if (/insufficient funds/i.test(e.message)) return "Not enough MON for gas. Get testnet MON at faucet.monad.xyz.";
    if (/exceeds balance/i.test(e.message)) return "Not enough balance.";
    if (/fetch|network|timeout|HTTP request failed/i.test(e.message)) return "Couldn't reach Monad testnet. Try again.";
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : "Transaction failed.";
}
