"use client";
// Conditional orders on KaddStrategies (contracts/src/testnet/KaddStrategies.sol): limit buy, take-profit, stop-loss
// and DCA against the testnet mirror pools. Funds are locked in the contract; anyone may execute a strategy once its
// condition holds, and proceeds always go to the owner. While the app is open, StrategyKeeper executes yours.
import { formatUnits, parseEventLogs, parseUnits, zeroAddress, type Address } from "viem";
import { kaddStrategiesAbi } from "./abi";
import { STRATEGIES } from "./addresses";
import type { TokenRef } from "./market";
import { refreshChain, requireAccount, toast } from "./store";
import { TUSDC, USDC_DECIMALS, approveIfNeeded, listMarkets, marketFor, openMirror, send, tokenBalance, txError, type Market } from "./venue";
import { publicClient, walletClient } from "./wallet";

export const STRATEGIES_READY = STRATEGIES !== zeroAddress;
export type Kind = "limit" | "takeProfit" | "stopLoss" | "dca";
export const KIND_LABEL: Record<Kind, string> = { limit: "Limit buy", takeProfit: "Take profit", stopLoss: "Stop loss", dca: "DCA" };

export type StrategyView = {
  id: bigint;
  kind: Kind;
  market: Market;
  isBuy: boolean;
  trigger: number | null; // $ per token, null = no price condition
  perExec: number; // in input units (tUSDC for buys, tokens for sells)
  remaining: number;
  interval: number;
  nextAt: number;
  ready: boolean;
  done: boolean;
};

const toTrigger = (usd: number) => BigInt(Math.round(usd * 10 ** USDC_DECIMALS)); // pool.price() units
const fromTrigger = (raw: bigint) => Number(raw) / 10 ** USDC_DECIMALS;

/** Smallest price a trigger can express: pool prices are whole tUSDC atoms per 1e18 token atoms. */
export const MIN_TRIGGER_USD = 1e-5;

type Create =
  | { kind: "limit"; usd: number; price: number }
  | { kind: "takeProfit" | "stopLoss"; pct: number; price: number }
  | { kind: "dca"; usdPerRun: number; runs: number; everySec: number; maxPrice: number | null };

/** Locks funds and creates the strategy (opening the token's testnet pool first if needed). */
export async function createStrategy(t: TokenRef & { price: number }, c: Create): Promise<boolean> {
  if (!STRATEGIES_READY) return toast("Strategies aren't deployed yet.", "err"), false;
  const me = await requireAccount().catch((e) => (toast(txError(e), "err"), null));
  if (!me) return false;
  try {
    const trigger = "price" in c ? c.price : c.maxPrice;
    if (trigger !== null && trigger < MIN_TRIGGER_USD) throw new Error("This token's price is too small for price triggers.");
    let market = await marketFor(t.address);
    if (!market) {
      if (c.kind === "takeProfit" || c.kind === "stopLoss") throw new Error(`You don't hold any ${t.symbol} yet.`);
      toast(`Opening a testnet pool for ${t.symbol}…`);
      market = await openMirror(t);
    }

    let isBuy = true;
    let above = false;
    let amount: bigint;
    let perExec: bigint;
    let interval = 0;
    if (c.kind === "limit") {
      amount = perExec = parseUnits(c.usd.toFixed(6), USDC_DECIMALS);
    } else if (c.kind === "dca") {
      perExec = parseUnits(c.usdPerRun.toFixed(6), USDC_DECIMALS);
      amount = perExec * BigInt(c.runs);
      interval = c.everySec;
    } else {
      isBuy = false;
      above = c.kind === "takeProfit";
      const held = await tokenBalance(market.base, me);
      amount = perExec = (held * BigInt(Math.round(c.pct * 100))) / 10_000n;
      if (amount === 0n) throw new Error(`You don't hold any ${t.symbol} yet.`);
    }
    const tokenIn = isBuy ? TUSDC : market.base;
    if (isBuy && (await tokenBalance(TUSDC, me)) < amount) throw new Error("Not enough tUSDC. Claim free test USDC first.");

    await approveIfNeeded(tokenIn, STRATEGIES, amount);
    const receipt = await send({
      address: STRATEGIES,
      abi: kaddStrategiesAbi,
      functionName: "create",
      args: [market.address, isBuy, amount, perExec, trigger === null ? 0n : toTrigger(trigger), above, interval],
    });
    const [log] = parseEventLogs({ abi: kaddStrategiesAbi, eventName: "Created", logs: receipt.logs });
    refreshChain();
    toast(`${KIND_LABEL[c.kind]} for ${t.symbol} is live (#${log.args.id})`);
    return true;
  } catch (e) {
    toast(txError(e), "err");
    return false;
  }
}

export async function cancelStrategy(id: bigint) {
  if (!(await requireAccount())) return false;
  try {
    await send({ address: STRATEGIES, abi: kaddStrategiesAbi, functionName: "cancel", args: [id] });
    refreshChain();
    toast(`Strategy #${id} cancelled, funds returned`);
    return true;
  } catch (e) {
    toast(txError(e), "err");
    return false;
  }
}

/** Fills one run. Throws on failure so the keeper can stay quiet; the UI wraps it with toasts. */
export async function executeStrategy(id: bigint) {
  walletClient(); // throws if locked
  const r = await send({ address: STRATEGIES, abi: kaddStrategiesAbi, functionName: "execute", args: [id] });
  refreshChain();
  return r;
}

export async function strategiesOf(owner: Address): Promise<StrategyView[]> {
  if (!STRATEGIES_READY) return [];
  const ids = await publicClient.readContract({ address: STRATEGIES, abi: kaddStrategiesAbi, functionName: "idsOf", args: [owner] });
  if (!ids.length) return [];
  const [rows, ready, markets] = await Promise.all([
    publicClient.multicall({ allowFailure: false, contracts: ids.map((id) => ({ address: STRATEGIES, abi: kaddStrategiesAbi, functionName: "get", args: [id] }) as const) }),
    publicClient.multicall({ allowFailure: false, contracts: ids.map((id) => ({ address: STRATEGIES, abi: kaddStrategiesAbi, functionName: "ready", args: [id] }) as const) }),
    listMarkets(),
  ]);
  return ids
    .map((id, i) => {
      const s = rows[i];
      const market = markets.find((m) => m.address.toLowerCase() === s.pool.toLowerCase());
      if (!market) return null;
      const dec = s.isBuy ? USDC_DECIMALS : market.decimals;
      const kind: Kind = s.interval > 0 ? "dca" : s.isBuy ? "limit" : s.above ? "takeProfit" : "stopLoss";
      return {
        id,
        kind,
        market,
        isBuy: s.isBuy,
        trigger: s.trigger > 0n ? fromTrigger(s.trigger) : null,
        perExec: Number(formatUnits(s.perExec, dec)),
        remaining: Number(formatUnits(s.remaining, dec)),
        interval: s.interval,
        nextAt: Number(s.nextAt),
        ready: ready[i],
        done: s.remaining === 0n,
      } satisfies StrategyView;
    })
    .filter((x): x is StrategyView => x !== null)
    .reverse();
}
