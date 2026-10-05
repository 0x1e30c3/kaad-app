"use client";
// Reads and writes for KaddClub on Monad testnet. Clubs trade on the Kadd testnet venue (see venue.ts); every write
// is simulated first so contract errors surface as readable messages before any gas is spent.
import { BaseError, ContractFunctionRevertedError, ContractFunctionZeroDataError, erc20Abi, parseEventLogs, zeroAddress, type Address } from "viem";
import { kaddClubAbi, kaddClubFactoryAbi } from "./abi";
import { CLUB_FACTORY, TUSDC, VENUE_READY, quote, readMarket, send, type Market } from "./venue";
import { publicClient, walletClient } from "./wallet";
export { txError } from "./venue";

/** How many of the newest clubs the list shows. ponytail: no pagination UI yet, add when clubs pile up. */
const LIST_LIMIT = 24;

export type ClubSummary = {
  address: Address;
  name: string;
  captain: Address;
  totalShares: bigint;
  usdc: bigint;
  maxTradeBps: number;
  flat: boolean; // false = holding positions, deposits paused
  markets: Address[];
};

export type ClubPosition = { market: Market; balance: bigint };
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
  if (!VENUE_READY) return [];
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
  const [name, captain, totalShares, usdc, maxTradeBps, flat, markets] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { ...c, functionName: "name" },
      { ...c, functionName: "captain" },
      { ...c, functionName: "totalShares" },
      { ...c, functionName: "quoteBalance" },
      { ...c, functionName: "maxTradeBps" },
      { ...c, functionName: "isFlat" },
      { ...c, functionName: "markets" },
    ],
  });
  return { address, name, captain, totalShares, usdc, maxTradeBps, flat, markets: [...markets] };
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
  const markets = await Promise.all(marketAddrs.map(readMarket));
  const tokens = [{ token: TUSDC, symbol: "tUSDC", decimals: 6 }, ...markets.map((m) => ({ token: m.base, symbol: m.symbol, decimals: m.decimals }))];
  const [balances, owed, walletUsdc] = await Promise.all([
    publicClient.multicall({ allowFailure: false, contracts: markets.map((m) => ({ ...c, functionName: "baseBalance", args: [m.address] }) as const) }),
    publicClient.multicall({ allowFailure: false, contracts: tokens.map((t) => ({ ...c, functionName: "owedOf", args: [me, t.token] }) as const) }),
    user ? publicClient.readContract({ address: TUSDC, abi: erc20Abi, functionName: "balanceOf", args: [user] }) : 0n,
  ]);
  return {
    ...summary,
    flat,
    myShares,
    walletUsdc,
    owed: tokens.map((t, i) => ({ ...t, amount: owed[i] })).filter((o) => o.amount > 0n),
    positions: markets.map((m, i) => ({ market: m, balance: balances[i] })),
  };
}

// ------------------------------------------------------------------ writes

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
    publicClient.readContract({ address: TUSDC, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
    publicClient.readContract({ address: TUSDC, abi: erc20Abi, functionName: "allowance", args: [owner, club] }),
  ]);
  if (amount > balance) throw new Error("Not enough tUSDC. Claim free test USDC first.");
  if (allowance < amount) await send({ address: TUSDC, abi: erc20Abi, functionName: "approve", args: [club, amount] });
  return send({ address: club, abi: kaddClubAbi, functionName: "deposit", args: [amount] });
}

export const redeem = (club: Address, shares: bigint) => send({ address: club, abi: kaddClubAbi, functionName: "redeem", args: [shares] });

export const claim = (club: Address, token: Address) => send({ address: club, abi: kaddClubAbi, functionName: "claim", args: [token] });

export async function trade(club: Address, market: Market, isBuy: boolean, amountIn: bigint, slippageBps: number) {
  const out = await quote(market, isBuy, amountIn);
  if (out === 0n) throw new Error("Amount too small.");
  const minOut = (out * BigInt(10_000 - slippageBps)) / 10_000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 120);
  return send({ address: club, abi: kaddClubAbi, functionName: "trade", args: [market.address, isBuy, amountIn, minOut, deadline] });
}
