/* eslint-disable @typescript-eslint/no-explicit-any -- dev script against a fork */
// Fork test: a brand-new address (like a Kadd passkey account) opens a Perpl account and trades BTC on-chain with the
// same order builders the app uses (lib/perplOrder.ts). Run against a fresh fork, within a minute of starting it
// (Perpl rejects orders when the mark is >60 s old, and a fork stops updating it):
//   anvil --fork-url https://testnet-rpc.monad.xyz --port 8547 &
//   ERRS=<dex-sdk>/abi/dex/Errors.abi.json EXABI=<dex-sdk>/abi/dex/Exchange.json npx tsx --conditions=react-server scripts/perpl-fork.mts
import { createTestClient, createWalletClient, http, parseAbi, publicActions, erc20Abi, parseEventLogs, type Address } from "viem";
import { monadTestnet } from "viem/chains";
import { PERPL, perplAbi, perpMarkets } from "../src/lib/perpl";
import { lotFor, marketOrder, liquidationPrice } from "../src/lib/perplOrder";
const EX = PERPL.testnet.exchange;
const AUSD = "0xa9012a055bd4e0edff8ce09f960291c09d5322dc" as Address;
const RICH = "0xbC1fD0165FBfF4EF32337E42D0e2Ad59bF52b203" as Address;
const FRESH = "0x000000000000000000000000000000000000AD01" as Address;
const t = createTestClient({ chain: monadTestnet, mode: "anvil", transport: http("http://127.0.0.1:8547") }).extend(publicActions);
const w = (account: Address) => createWalletClient({ account, chain: monadTestnet, transport: http("http://127.0.0.1:8547") });
const ex = parseAbi([
  "struct OrderDesc { uint256 orderDescId; uint256 perpId; uint8 orderType; uint256 orderId; uint256 pricePNS; uint256 lotLNS; uint256 expiryBlock; bool postOnly; bool fillOrKill; bool immediateOrCancel; uint256 maxMatches; uint256 leverageHdths; uint256 lastExecutionBlock; uint256 amountCNS; uint256 maxNegPnlCollatBPS; }",
  "function createAccount(uint256 amountCNS) returns (uint256)",
  "function withdrawCollateral(uint256 amountCNS)",
  "function execOrder(OrderDesc orderDesc) returns (uint256 perpId, uint256 orderId)",
  "event AccountCreated(address account, uint256 id)",
  "event PositionOpenedV2(uint256 perpId, uint256 accountId, uint8 positionType, uint256 leverageHdths, uint256 depositCNS, int256 pnlCollateralizedCNS, uint256 pricePNS, uint256 lotLNS, uint256 insFeeCNS, uint256 protFeeCNS, uint256 priceResiduePNSQ16)",
  "event PositionClosed(uint256 perpId, uint256 accountId, uint8 positionType, uint256 pricePNS, int256 deltaPnlCNS, int256 fundingCNS)",
  "event TakerOrderFilledV2(uint256 entryPricePNS, uint256 collatPricePNS, uint256 pnlPricePNS, uint256 lotLNS, uint256 feeCNS, int256 amountCNS, uint256 balanceCNS, uint256 builderId, uint256 builderFeeCNS)",
]);
const errs = (await import(process.env.ERRS!, { with: { type: "json" } })).default;
const errAbi = [...(errs.abi ?? errs), ...(await import(process.env.EXABI!, { with: { type: "json" } })).default.abi.filter((x: any) => x.type === "error")];
const send = async (from: Address, req: any) => {
  try { await t.simulateContract({ ...req, abi: [...req.abi, ...errAbi], account: from }); } catch (e: any) { console.log("SIM", req.functionName, e.shortMessage, e.metaMessages?.slice(0, 3)); }
  const hash = await w(from).writeContract({ ...req, account: from, chain: monadTestnet, gas: 5_000_000n });
  const rc = await t.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`${req.functionName} reverted`);
  return rc;
};
for (const a of [RICH, FRESH]) { await t.impersonateAccount({ address: a }); await t.setBalance({ address: a, value: 10n ** 19n }); }

// 1. Get AUSD to the fresh wallet (a funded trader withdraws some and sends it).
if ((await t.readContract({ address: AUSD, abi: erc20Abi, functionName: "balanceOf", args: [FRESH] })) === 0n && (await t.readContract({ address: EX, abi: perplAbi, functionName: "getAccountByAddr", args: [FRESH] }).catch(() => ({ accountId: 0n }))).accountId === 0n)
  await send(RICH, { address: AUSD, abi: erc20Abi, functionName: "transfer", args: [FRESH, 150_000_000n] });
console.log("fresh AUSD", Number(await t.readContract({ address: AUSD, abi: erc20Abi, functionName: "balanceOf", args: [FRESH] })) / 1e6);

// 2. The fresh wallet opens a Perpl account with 120 AUSD.
const existing = await t.readContract({ address: EX, abi: perplAbi, functionName: "getAccountByAddr", args: [FRESH] }).catch(() => ({ accountId: 0n, balanceCNS: 0n }));
if (existing.accountId === 0n) {
  await send(FRESH, { address: AUSD, abi: erc20Abi, functionName: "approve", args: [EX, 2n ** 256n - 1n] });
  const created = await send(FRESH, { address: EX, abi: ex, functionName: "createAccount", args: [120_000_000n] });
  const [acc] = parseEventLogs({ abi: ex, eventName: "AccountCreated", logs: created.logs });
  console.log("account", acc.args.id, acc.args.account);
} else console.log("account exists", existing.accountId, Number(existing.balanceCNS) / 1e6);

// 3. Market buy ~$100 of BTC at 2x: IOC limit 2% above mark.
const btc = (await perpMarkets("testnet")).find((m) => m.name === "BTC")!;
const [start] = await t.readContract({ address: EX, abi: perplAbi, functionName: "getPositionIds", args: [BigInt(btc.id)] });
const mark = Number((await t.readContract({ address: EX, abi: perplAbi, functionName: "getPositionsV2", args: [BigInt(btc.id), start, 1n] }))[2]);
const head = await t.getBlockNumber();
const markPNS = BigInt(mark);
const lot = lotFor(100, markPNS, btc);
console.log("btc", btc.id, "mark", mark, "lot", lot, "liq@2x≈", liquidationPrice("long", mark / 10, 2, btc.maintLeverage).toFixed(0));
const opened = await send(FRESH, { address: EX, abi: ex, functionName: "execOrder", args: [marketOrder({ terms: btc, action: "open", side: "long", lot, markPNS, leverage: 2, head })] });
const pos = parseEventLogs({ abi: ex, eventName: "PositionOpenedV2", logs: opened.logs });
console.log("opened", pos.map((p) => ({ acct: p.args.accountId, type: p.args.positionType, lot: p.args.lotLNS, price: p.args.pricePNS, deposit: Number(p.args.depositCNS) / 1e6, lev: Number(p.args.leverageHdths) / 100 })));
const short = await send(FRESH, { address: EX, abi: ex, functionName: "execOrder", args: [marketOrder({ terms: btc, action: "close", side: "long", lot, markPNS, leverage: 2, head: await t.getBlockNumber(), id: BigInt(Date.now() + 5) })] });
console.log("closed", parseEventLogs({ abi: ex, eventName: "PositionClosed", logs: short.logs }).map((c) => Number(c.args.deltaPnlCNS) / 1e6));
process.exit(0);
