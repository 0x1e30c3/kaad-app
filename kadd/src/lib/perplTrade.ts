"use client";
// Trade perps on Perpl straight from the passkey account: no API key, no whitelist. The Exchange contract keys the
// account by msg.sender, so the first AUSD deposit opens it (createAccount) and orders go through execOrder.
// Testnet uses free test AUSD; mainnet uses real AUSD (Get AUSD swaps MON → AUSD through Kuru).
import { BaseError, ContractFunctionRevertedError, erc20Abi, parseAbi, parseEventLogs, parseUnits, type Abi, type Address } from "viem";
import { mainnetPublic, MON, quoteKuru } from "./mainnet";
import { lotFor, marketOrder, perplError, type PerpSide, type PerpTerms } from "./perplOrder";
import { refreshChain, requireAccount, toast } from "./store";
import { txError } from "./venue";
import { mainnetWalletClient, publicClient, walletClient } from "./wallet";

export type PerpNet = "testnet" | "mainnet";
export const PERPL_APP = { testnet: "https://testnet.perpl.xyz", mainnet: "https://app.perpl.xyz" } as const;
const NET = {
  testnet: { exchange: "0x1964c32f0be608e7d29302aff5e61268e72080cc" as Address, ausd: "0xa9012a055bd4e0edff8ce09f960291c09d5322dc" as Address, pub: () => publicClient, wallet: () => walletClient() },
  mainnet: { exchange: "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F" as Address, ausd: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a" as Address, pub: () => mainnetPublic, wallet: () => mainnetWalletClient() },
};
export const AUSD = { testnet: NET.testnet.ausd, mainnet: NET.mainnet.ausd };
const CNS = 1e6;

const exchangeAbi = parseAbi([
  "struct OrderDesc { uint256 orderDescId; uint256 perpId; uint8 orderType; uint256 orderId; uint256 pricePNS; uint256 lotLNS; uint256 expiryBlock; bool postOnly; bool fillOrKill; bool immediateOrCancel; uint256 maxMatches; uint256 leverageHdths; uint256 lastExecutionBlock; uint256 amountCNS; uint256 maxNegPnlCollatBPS; }",
  "struct PositionInfo { uint256 accountId; uint256 nextNodeId; uint256 prevNodeId; uint8 positionType; uint256 depositCNS; uint256 pricePNS; uint256 lotLNS; uint256 entryBlock; int256 pnlCNS; int256 deltaPnlCNS; int256 premiumPnlCNS; uint256 priceResiduePNSQ16; }",
  "struct PositionBitMap { uint256 bank1; uint256 bank2; uint256 bank3; uint256 bank4; }",
  "struct AccountInfo { uint256 accountId; uint256 balanceCNS; uint256 lockedBalanceCNS; uint8 frozen; address accountAddr; PositionBitMap positions; }",
  "function createAccount(uint256 amountCNS) returns (uint256 accountId)",
  "function depositCollateral(uint256 amountCNS)",
  "function withdrawCollateral(uint256 amountCNS)",
  "function execOrder(OrderDesc orderDesc) returns (uint256 perpId, uint256 orderId)",
  "function getAccountByAddr(address accountAddress) view returns (AccountInfo accountInfo)",
  "function getPositionV2(uint256 perpId, uint256 accountId) view returns (PositionInfo positionInfo, uint256 markPricePNS, bool markPriceValid)",
  "function getMinAccountOpenCNS() view returns (uint256)",
  "event PositionOpenedV2(uint256 perpId, uint256 accountId, uint8 positionType, uint256 leverageHdths, uint256 depositCNS, int256 pnlCollateralizedCNS, uint256 pricePNS, uint256 lotLNS, uint256 insFeeCNS, uint256 protFeeCNS, uint256 priceResiduePNSQ16)",
  "event PositionIncreasedV2(uint256 perpId, uint256 accountId, uint8 positionType, uint256 leverageHdths, uint256 startDepositCNS, uint256 endDepositCNS, int256 pnlCollateralizedCNS, int256 premiumPnlSettledCNS, uint256 maxNegPnlCollatBPS, uint256 pricePNS, uint256 startLotLNS, uint256 endLotLNS, uint256 insFeeCNS, uint256 protFeeCNS, uint256 priceResiduePNSQ16)",
  "event PositionClosed(uint256 perpId, uint256 accountId, uint8 positionType, uint256 pricePNS, int256 deltaPnlCNS, int256 fundingCNS)",
  "event PositionDecreased(uint256 perpId, uint256 accountId, uint8 positionType, uint256 startDepositCNS, uint256 endDepositCNS, uint256 startLotLNS, uint256 endLotLNS, int256 deltaPnlCNS, int256 fundingCNS)",
  // Errors the ticket explains in plain language (perplError); the rest fall back to the generic message.
  "error MarkPriceAgeExceedsMax(uint256 perpId, uint256 markTimestamp, uint256 timestamp, uint256 maxAgeSec)",
  "error OracleAgeExceedsMax(uint256 perpId, uint256 oracleTimestamp, uint256 timestamp, uint256 maxAgeSec)",
  "error AccountDoesNotExist(address accountAddress)",
  "error AmountExceedsAvailableBalance(uint256 amountCNS, uint256 availableBalanceCNS, uint256 balanceCNS)",
  "error LotOutOfRange(uint256 lotLNS, uint256 minLotLNS, uint256 maxLotLNS)",
  "error PriceOutOfRange(uint256 pricePNS, uint256 minPricePNS, uint256 maxPricePNS)",
  "error ExchangeHalted()",
  "error AccountFrozen(uint8 status)",
  "error PostOrderUnderMinimum(uint256 orderAmountCNS, uint256 minAmountCNS)",
  "error ContractNotOperational(uint256 perpId, uint8 status)",
  "error OrderSizeExceedsAvailableSize(uint256 orderLotLNS, uint256 availableLotLNS, uint256 positionLotLNS)",
  "error PositionDoesNotExist(uint256 perpId, uint256 accountId)",
]);

export type PerpMarketView = PerpTerms & { ticker: { mark: number; prev: number; volume24h: number; openInterest: number } | null };
export const fetchPerpMarkets = (net: PerpNet): Promise<PerpMarketView[]> =>
  fetch(`/api/perpl/markets?net=${net}`).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Perpl unavailable");
    return j;
  });

export type PerpAccount = { accountId: bigint; wallet: number; balance: number; locked: number; minOpen: number };

/** AUSD in the wallet and in the Perpl account (accountId 0 = no account yet). */
export async function perpAccount(net: PerpNet, me: Address): Promise<PerpAccount> {
  const n = NET[net];
  const [wallet, info, minOpen] = await Promise.all([
    n.pub().readContract({ address: n.ausd, abi: erc20Abi, functionName: "balanceOf", args: [me] }),
    n.pub().readContract({ address: n.exchange, abi: exchangeAbi, functionName: "getAccountByAddr", args: [me] }).catch(() => null), // reverts when there's no account
    n.pub().readContract({ address: n.exchange, abi: exchangeAbi, functionName: "getMinAccountOpenCNS" }),
  ]);
  return { accountId: info?.accountId ?? 0n, wallet: Number(wallet) / CNS, balance: Number(info?.balanceCNS ?? 0n) / CNS, locked: Number(info?.lockedBalanceCNS ?? 0n) / CNS, minOpen: Number(minOpen) / CNS };
}

export type MyPosition = { market: PerpTerms; side: PerpSide; lot: bigint; size: number; entry: number; mark: number; deposit: number; leverage: number; pnl: number };

/** The account's open positions, read straight from the contract (fresh after every trade). */
export async function myPositions(net: PerpNet, accountId: bigint, markets: PerpTerms[]): Promise<MyPosition[]> {
  if (!accountId || !markets.length) return [];
  const n = NET[net];
  const rows = await n.pub().multicall({ allowFailure: true, contracts: markets.map((m) => ({ address: n.exchange, abi: exchangeAbi, functionName: "getPositionV2", args: [BigInt(m.id), accountId] }) as const) });
  return rows.flatMap((r, i) => {
    if (r.status !== "success" || r.result[0].lotLNS === 0n) return [];
    const [p, markPNS] = r.result;
    const m = markets[i];
    const size = Number(p.lotLNS) / 10 ** m.sizeDecimals;
    const mark = Number(markPNS) / 10 ** m.priceDecimals;
    const deposit = Number(p.depositCNS) / CNS;
    return [{ market: m, side: p.positionType === 0 ? "long" : "short", lot: p.lotLNS, size, entry: Number(p.pricePNS) / 10 ** m.priceDecimals, mark, deposit, leverage: deposit > 0 ? (size * mark) / deposit : 0, pnl: Number(p.pnlCNS) / CNS }] as MyPosition[];
  });
}

/** Simulates (so reverts read as Perpl's own error), sends with the passkey session, waits for the receipt. */
async function send(net: PerpNet, req: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] }) {
  const n = NET[net];
  const wallet = n.wallet();
  const { request } = await n.pub().simulateContract({ ...req, account: wallet.account } as never);
  const hash = await wallet.writeContract(request as never);
  const receipt = await n.pub().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction failed onchain");
  return receipt;
}

function explain(e: unknown): string {
  const revert = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
  const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
  return perplError(name) ?? txError(e);
}

async function me() {
  const a = await requireAccount();
  if (!a) throw new Error("Sign in with your passkey first.");
  return a;
}

/** Moves `amount` AUSD from the wallet into Perpl: the first deposit opens the account. */
export async function depositAusd(net: PerpNet, amount: number): Promise<boolean> {
  try {
    const n = NET[net];
    const a = await me();
    const atoms = parseUnits(amount.toFixed(6), 6);
    const acct = await perpAccount(net, a);
    if (acct.wallet < amount) throw new Error(`You have ${acct.wallet.toFixed(2)} AUSD in your wallet.`);
    if (!acct.accountId && amount < acct.minOpen) throw new Error(`Your first deposit opens your Perpl account: at least ${acct.minOpen} AUSD.`);
    const allowance = await n.pub().readContract({ address: n.ausd, abi: erc20Abi, functionName: "allowance", args: [a, n.exchange] });
    if (allowance < atoms) await send(net, { address: n.ausd, abi: erc20Abi, functionName: "approve", args: [n.exchange, atoms] });
    await send(net, { address: n.exchange, abi: exchangeAbi, functionName: acct.accountId ? "depositCollateral" : "createAccount", args: [atoms] });
    toast(acct.accountId ? `Deposited ${amount} AUSD to Perpl.` : `Perpl account opened with ${amount} AUSD.`);
    refreshChain();
    return true;
  } catch (e) {
    toast(explain(e), "err");
    return false;
  }
}

export async function withdrawAusd(net: PerpNet, amount: number): Promise<boolean> {
  try {
    await me();
    await send(net, { address: NET[net].exchange, abi: exchangeAbi, functionName: "withdrawCollateral", args: [parseUnits(amount.toFixed(6), 6)] });
    toast(`Withdrew ${amount} AUSD to your wallet.`);
    refreshChain();
    return true;
  } catch (e) {
    toast(explain(e), "err");
    return false;
  }
}

/** Current mark (scaled) and whether Perpl considers it fresh, read on-chain right before an order. */
async function markOf(net: PerpNet, m: PerpTerms, accountId: bigint) {
  const n = NET[net];
  const [, mark, valid] = await n.pub().readContract({ address: n.exchange, abi: exchangeAbi, functionName: "getPositionV2", args: [BigInt(m.id), accountId] });
  if (!valid) throw new Error("Perpl's price feed is a little behind right now. Try again in a few seconds.");
  return mark;
}

/** Market order: opens (or adds to) `side` for `usd` of notional at `leverage`. Returns the fill price, or null. */
export async function openPerp(net: PerpNet, m: PerpTerms, side: PerpSide, usd: number, leverage: number): Promise<number | null> {
  try {
    const a = await me();
    const acct = await perpAccount(net, a);
    if (!acct.accountId) throw new Error("Deposit AUSD first: your first deposit opens your Perpl account.");
    const margin = usd / leverage;
    if (margin > acct.balance) throw new Error(`This needs ${margin.toFixed(2)} AUSD of margin; you have ${acct.balance.toFixed(2)} free in Perpl.`);
    const n = NET[net];
    const [mark, head] = await Promise.all([markOf(net, m, acct.accountId), n.pub().getBlockNumber()]);
    const lot = lotFor(usd, mark, m);
    if (lot === 0n) throw new Error("Size is too small for this market.");
    const receipt = await send(net, { address: n.exchange, abi: exchangeAbi, functionName: "execOrder", args: [marketOrder({ terms: m, action: "open", side, lot, markPNS: mark, leverage, head })] });
    const filled = parseEventLogs({ abi: exchangeAbi, logs: receipt.logs }).find((l) => l.eventName === "PositionOpenedV2" || l.eventName === "PositionIncreasedV2");
    if (!filled) throw new Error("No fill: the book moved past your price bound. Nothing was spent; try again.");
    const price = Number(filled.args.pricePNS) / 10 ** m.priceDecimals;
    toast(`${side === "long" ? "Long" : "Short"} ${m.name} opened at ${price.toLocaleString("en-US", { maximumSignificantDigits: 6 })} on Perpl ${net}.`);
    refreshChain();
    return price;
  } catch (e) {
    toast(explain(e), "err");
    return null;
  }
}

/** Market-closes the whole position. */
export async function closePerp(net: PerpNet, p: MyPosition, accountId: bigint): Promise<boolean> {
  try {
    await me();
    const n = NET[net];
    const [mark, head] = await Promise.all([markOf(net, p.market, accountId), n.pub().getBlockNumber()]);
    const receipt = await send(net, { address: n.exchange, abi: exchangeAbi, functionName: "execOrder", args: [marketOrder({ terms: p.market, action: "close", side: p.side, lot: p.lot, markPNS: mark, leverage: Math.max(1, p.leverage), head })] });
    const logs = parseEventLogs({ abi: exchangeAbi, logs: receipt.logs });
    const closed = logs.find((l) => l.eventName === "PositionClosed" || l.eventName === "PositionDecreased");
    if (!closed) throw new Error("No fill: the book moved past your price bound. Try again.");
    const pnl = (Number(closed.args.deltaPnlCNS) + Number(closed.args.fundingCNS)) / CNS;
    toast(`${p.market.name} ${closed.eventName === "PositionClosed" ? "closed" : "partly closed"}: ${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}.`);
    refreshChain();
    return true;
  } catch (e) {
    toast(explain(e), "err");
    return false;
  }
}

/** Mainnet only: how much AUSD `mon` MON buys through Kuru Flow for `me` (a quote, nothing is signed). */
export async function quoteAusd(me: Address, mon: number): Promise<number> {
  const q = await quoteKuru(me, MON, NET.mainnet.ausd, parseUnits(mon.toString(), 18));
  return Number(q.output) / CNS;
}
