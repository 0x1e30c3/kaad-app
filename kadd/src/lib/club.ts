"use client";
// Reads and writes for KaddClub on Monad testnet. Every write is simulated first so contract errors surface
// as readable messages before any gas is spent.
import { BaseError, ContractFunctionRevertedError, ContractFunctionZeroDataError, erc20Abi, parseEventLogs, zeroAddress, type Abi, type Address } from "viem";
import { isMeraError } from "@category-labs/mera";
import { kuruErrorAbi, orderBookAbi } from "@toxicflow-labs/ts-sdk/generated";
import { kaddClubAbi, kaddClubFactoryAbi } from "./abi";
import { CLUB_FACTORY, USDC, bookPrices, marketOf, type Market } from "./kuru";
import { passkeyError, publicClient, walletClient } from "./wallet";

/** How many of the newest clubs the list shows. ponytail: no pagination UI yet, add when clubs pile up. */
const LIST_LIMIT = 24;

export type ClubSummary = {
  address: Address;
  name: string;
  captain: Address;
  totalShares: bigint;
  usdc: bigint;
  maxTradeBps: number;
};

export type ClubPosition = { market: Market; balance: bigint; bid: number | null; ask: number | null };
export type Owed = { token: Address; symbol: string; decimals: number; amount: bigint };

export type ClubDetail = ClubSummary & {
  flat: boolean;
  myShares: bigint;
  positions: ClubPosition[];
  walletUsdc: bigint;
  owed: Owed[];
};

export class ClubNotFound extends Error {}

export async function listClubs(): Promise<ClubSummary[]> {
  const count = await publicClient.readContract({ address: CLUB_FACTORY, abi: kaddClubFactoryAbi, functionName: "clubCount" });
  const first = count > BigInt(LIST_LIMIT) ? count - BigInt(LIST_LIMIT) : 0n;
  const ids = Array.from({ length: Number(count - first) }, (_, i) => first + BigInt(i));
  if (!ids.length) return [];
  const addresses = await publicClient.multicall({
    allowFailure: false,
    contracts: ids.map((i) => ({ address: CLUB_FACTORY, abi: kaddClubFactoryAbi, functionName: "clubs", args: [i] }) as const),
  });
  const clubs = await Promise.all(addresses.map((a) => readSummary(a)));
  return clubs.reverse(); // newest first
}

async function readSummary(address: Address): Promise<ClubSummary> {
  const c = { address, abi: kaddClubAbi } as const;
  const [name, captain, totalShares, usdc, maxTradeBps] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { ...c, functionName: "name" },
      { ...c, functionName: "captain" },
      { ...c, functionName: "totalShares" },
      { ...c, functionName: "quoteBalance" },
      { ...c, functionName: "maxTradeBps" },
    ],
  });
  return { address, name, captain, totalShares, usdc, maxTradeBps };
}

/** Known markets come from kuru.ts; anything else (the factory is permissionless) is described from the book itself. */
async function resolveMarket(address: Address): Promise<Market> {
  const known = marketOf(address);
  if (known) return known;
  const [base, params] = await Promise.all([
    publicClient.readContract({ address, abi: orderBookAbi, functionName: "baseToken" }),
    publicClient.readContract({ address, abi: orderBookAbi, functionName: "getMarketParams" }),
  ]);
  const [symbol, decimals] =
    base === zeroAddress
      ? ["MON", 18]
      : await Promise.all([
          publicClient.readContract({ address: base, abi: erc20Abi, functionName: "symbol" }).catch(() => "TOKEN"),
          publicClient.readContract({ address: base, abi: erc20Abi, functionName: "decimals" }),
        ]);
  return { address, symbol, base, decimals, pricePrecision: Number(params[0]), dust: 0n };
}

export async function getClub(address: Address, user?: Address): Promise<ClubDetail> {
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") throw new ClubNotFound();

  const c = { address, abi: kaddClubAbi } as const;
  const me = user ?? zeroAddress;
  // A contract that doesn't answer the club interface (e.g. the factory itself) is "not a club", not a network error.
  const notAClub = (e: unknown) => {
    const isAbiMismatch = e instanceof BaseError && !!e.walk((x) => x instanceof ContractFunctionZeroDataError || x instanceof ContractFunctionRevertedError);
    throw isAbiMismatch ? new ClubNotFound() : e;
  };
  const [summary, [flat, marketAddrs, myShares]] = await Promise.all([
    readSummary(address).catch(notAClub),
    publicClient.multicall({
      allowFailure: false,
      contracts: [
        { ...c, functionName: "isFlat" },
        { ...c, functionName: "markets" },
        { ...c, functionName: "sharesOf", args: [me] },
      ],
    }).catch(notAClub),
  ]);
  const markets = await Promise.all(marketAddrs.map(resolveMarket));
  const tokens = [{ token: USDC, symbol: "USDC", decimals: 6 }, ...markets.map((m) => ({ token: m.base, symbol: m.symbol, decimals: m.decimals }))];
  const [balances, books, owed, walletUsdc] = await Promise.all([
    publicClient.multicall({ allowFailure: false, contracts: markets.map((m) => ({ ...c, functionName: "baseBalance", args: [m.address] }) as const) }),
    publicClient.multicall({ allowFailure: false, contracts: markets.map((m) => ({ address: m.address, abi: orderBookAbi, functionName: "bestBidAsk" }) as const) }),
    publicClient.multicall({ allowFailure: false, contracts: tokens.map((t) => ({ ...c, functionName: "owedOf", args: [me, t.token] }) as const) }),
    user ? publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [user] }) : 0n,
  ]);
  return {
    ...summary,
    flat,
    myShares,
    walletUsdc,
    owed: tokens.map((t, i) => ({ ...t, amount: owed[i] })).filter((o) => o.amount > 0n),
    positions: markets.map((m, i) => ({ market: m, balance: balances[i], ...bookPrices(m, books[i] as [number, number]) })),
  };
}

// ------------------------------------------------------------------ writes

const ERRORS_ABI = [...kaddClubAbi, ...kaddClubFactoryAbi, ...kuruErrorAbi] as Abi;

async function send(params: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }) {
  const wc = walletClient();
  const { request } = await publicClient.simulateContract({ ...params, abi: ERRORS_ABI.concat(params.abi), account: wc.account } as never);
  const hash = await wc.writeContract(request as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction failed onchain");
  return receipt;
}

export async function createClub(name: string, maxTradeBps: number, markets: Market[]) {
  const receipt = await send({
    address: CLUB_FACTORY,
    abi: kaddClubFactoryAbi,
    functionName: "createClub",
    args: [name, maxTradeBps, markets.map((m) => m.address), markets.map((m) => m.dust)],
  });
  const [log] = parseEventLogs({ abi: kaddClubFactoryAbi, eventName: "ClubCreated", logs: receipt.logs });
  return log.args.club;
}

export async function depositUsdc(club: Address, amount: bigint) {
  const owner = walletClient().account.address;
  const [balance, allowance] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [owner, club] }),
  ]);
  if (amount > balance) throw new Error("Not enough USDC balance.");
  if (allowance < amount) await send({ address: USDC, abi: erc20Abi, functionName: "approve", args: [club, amount] });
  return send({ address: club, abi: kaddClubAbi, functionName: "deposit", args: [amount] });
}

export const redeem = (club: Address, shares: bigint) => send({ address: club, abi: kaddClubAbi, functionName: "redeem", args: [shares] });

export const claim = (club: Address, token: Address) => send({ address: club, abi: kaddClubAbi, functionName: "claim", args: [token] });

/** Quote an exact-input swap on the Kuru book; amountOut is 0 when there is no liquidity. */
export async function quoteSwap(market: Market, isBuy: boolean, amountIn: bigint) {
  const r = await publicClient.readContract({ address: market.address, abi: orderBookAbi, functionName: "estimateSwap", args: [isBuy, amountIn] });
  return r.amountOut;
}

export async function trade(club: Address, market: Market, isBuy: boolean, amountIn: bigint, slippageBps: number) {
  const out = await quoteSwap(market, isBuy, amountIn);
  if (out === 0n) throw new Error("The Kuru order book for this market is empty");
  const minOut = (out * BigInt(10_000 - slippageBps)) / 10_000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);
  return send({ address: club, abi: kaddClubAbi, functionName: "trade", args: [market.address, isBuy, amountIn, minOut, deadline] });
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
  SlippageExceeded: "Price moved past the slippage limit, or not enough liquidity.",
};

export function txError(e: unknown): string {
  if (isMeraError(e)) return passkeyError(e);
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
    if (name) return MESSAGES[name] ?? `Rejected by contract: ${name}`;
    if (/insufficient funds/i.test(e.message)) return "Not enough MON for gas. Top up at faucet.monad.xyz.";
    if (/exceeds balance/i.test(e.message)) return "Not enough USDC balance.";
    if (/fetch|network|timeout|HTTP request failed/i.test(e.message)) return "Couldn't reach Monad testnet. Try again.";
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : "Transaction failed.";
}
