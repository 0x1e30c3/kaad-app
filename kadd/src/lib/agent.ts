// Public, read-only JSON API for AI agents (the Kadd skills in /skills): market lists, token due diligence, wallet
// profiles with copy backtests, smart-money boards, network stats, and ready-to-run `cast` plans for testnet trades
// and auto copy. Plans never touch a private key: the agent signs them itself with its own testnet key.
import "server-only";
import { erc20Abi, formatUnits, getAddress, isAddress, parseUnits, zeroAddress, type Address } from "viem";
import { kaddCopyAbi, kaddPoolAbi, kaddVenueAbi } from "./abi";
import { COPY, TUSDC, VENUE } from "./addresses";
import { publicClient } from "./chain";
import { getLeaderboard, type Period } from "./leaderboard";
import { hot, newPairs, orEmpty, quotes, searchTokens, tokenDetail, topVolume, trending, type MarketToken } from "./market";
import { getStats } from "./stats";
import { aggregate, backtest, getMainnetBoard, getWallet } from "./wallets";
import { smartMoney, smartWallet } from "./nansen";

export class BadRequest extends Error {}

const RPC = "https://testnet-rpc.monad.xyz";
const SEED_USD = 50_000; // KaddVenue.SEED_QUOTE
const castSend = (to: string, sig: string, args: (string | number | bigint)[]) =>
  `cast send ${to} "${sig}" ${args.map((a) => (typeof a === "string" && /[\s()]/.test(a) ? `"${a}"` : String(a))).join(" ")} --rpc-url ${RPC} --private-key $KADD_PRIVATE_KEY`;
const round = (n: number, d = 2) => Number(n.toFixed(d));
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return round(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const sig = (n: number) => Number(n.toPrecision(4));

const tokenRow = (t: MarketToken) => ({
  address: t.address,
  symbol: t.symbol,
  name: t.name,
  priceUsd: sig(t.price),
  marketCapUsd: Math.round(t.mc),
  liquidityUsd: Math.round(t.liq),
  change: { h1: round(t.change.h1), h6: round(t.change.h6), h24: round(t.change.h24) },
  volume24hUsd: Math.round(t.vol.h24),
  txns24h: t.txns.h24,
  ageHours: round((Date.now() - t.createdAt) / 36e5, 1),
  risk: t.risk,
  pool: t.pool,
  dex: t.dex,
  path: `/token/${t.address}`,
});

/** Biggest 1h movers among the trending and 1h-hot pools (GeckoTerminal's "hot" ranks activity, not gain). */
const gainers = async () => {
  const all = [...(await orEmpty(hot())), ...(await orEmpty(trending()))];
  return [...new Map(all.map((t) => [t.address, t])).values()].sort((a, b) => b.change.h1 - a.change.h1);
};
const LISTS = { trending, hot, gainers, new: newPairs, volume: topVolume } as const;

export async function search(q: URLSearchParams) {
  const text = (q.get("q") ?? "").trim();
  if (text.length < 2) throw new BadRequest("q must be a ticker, name or address (2+ chars)");
  const found = (await searchTokens(text)).slice(0, Math.min(Number(q.get("limit")) || 5, 20));
  return { query: text, count: found.length, tokens: found.map(tokenRow) };
}

export async function market(q: URLSearchParams) {
  const list = (q.get("list") ?? "trending") as keyof typeof LISTS;
  if (!(list in LISTS)) throw new BadRequest(`list must be one of ${Object.keys(LISTS).join(", ")}`);
  const limit = Math.min(Number(q.get("limit")) || 20, 50);
  const tokens = await orEmpty(LISTS[list]());
  return { chain: "monad", list, count: Math.min(limit, tokens.length), tokens: tokens.slice(0, limit).map(tokenRow) };
}

export async function token(address: string) {
  if (!isAddress(address, { strict: false })) throw new BadRequest("token address must be 0x + 40 hex chars");
  const t = await tokenDetail(address.toLowerCase());
  if (!t) return null;
  const pool = await publicClient.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "poolOf", args: [getAddress(address)] });
  const testnetPrice = pool === zeroAddress ? null : Number(await publicClient.readContract({ address: pool, abi: kaddPoolAbi, functionName: "price" })) / 1e6;
  return {
    ...tokenRow(t),
    holders: t.holders,
    gtScore: t.score,
    checks: t.checks,
    analysis: {
      riskScore: t.analysis.score, // 0 = safest, 100 = most dangerous
      level: t.analysis.level,
      summary: t.analysis.summary,
      factors: t.analysis.factors.map((f) => ({ severity: f.severity, points: f.points, title: f.title, detail: f.detail })),
      advice: t.analysis.advice,
    },
    links: t.links,
    recentTrades: t.trades?.slice(0, 20).map((x) => ({ side: x.side, usd: round(x.usd), ageSec: x.ageSec, wallet: x.trader, tx: x.tx })) ?? null,
    kadd: { testnetPool: pool === zeroAddress ? null : pool, testnetPriceUsd: testnetPrice && sig(testnetPrice), tradable: true },
  };
}

export async function wallet(address: string) {
  if (!isAddress(address, { strict: false })) throw new BadRequest("wallet address must be 0x + 40 hex chars");
  const [w, smart] = await Promise.all([getWallet(getAddress(address)), smartWallet(address)]);
  const summary = aggregate(w.trades)[0] ?? null;
  const bt = backtest(w.trades);
  return {
    address: w.address,
    nadName: w.nns,
    nansenSmartMoney: smart && { label: smart.label, pnl30dUsd: round(smart.totalPnlUsd), realizedUsd: round(smart.realizedPnlUsd), winRatePct: Math.round(smart.winRatePct), trades: smart.trades },
    windowHours: w.since ? round((Date.now() - w.since) / 36e5, 1) : null,
    note: "Trades cover the latest ~300 per pool of the tokens Kadd lists, so the window is hours, not days.",
    activity: summary && {
      volumeUsd: round(summary.volume),
      trades: summary.trades,
      buys: summary.buys,
      sells: summary.sells,
      netFlowUsd: round(summary.net),
      medianBuyUsd: median(w.trades.filter((t) => t.side === "buy").map((t) => t.usd)),
      tokens: summary.tokens.map((t) => t.symbol),
    },
    copyBacktest: {
      rule: "$10 per buy at the wallet's own price, exit the whole position when it sells, open positions at today's price, before fees",
      pnlUsd: round(bt.pnl),
      roiPct: round(bt.roi),
      investedUsd: bt.invested,
      tradesCopied: bt.copied,
      closedPositions: bt.closed,
      winRatePct: bt.winRate === null ? null : Math.round(bt.winRate),
    },
    holdings: w.holdings?.map((h) => ({ symbol: h.token.symbol, token: h.token.address, amount: sig(h.amount), usd: round(h.usd) })) ?? null,
    monBalance: w.mon === null ? null : round(w.mon, 4),
    kaddTestnet30d: w.kadd && { pnlUsd: round(w.kadd.pnl), roiPct: round(w.kadd.roi), trades: w.kadd.trades, volumeUsd: round(w.kadd.volume), winRatePct: w.kadd.win },
    recentTrades: w.trades.slice(0, 30).map((t) => ({ at: new Date(t.at).toISOString(), side: t.side, symbol: t.token.symbol, token: t.token.address, usd: round(t.usd), priceUsd: sig(t.price), tx: t.tx })),
    path: `/wallet/${w.address}`,
  };
}

const SORTS = ["volume", "copyRoi", "trades", "net", "lastAt"] as const;

export async function leaderboard(q: URLSearchParams) {
  const limit = Math.min(Number(q.get("limit")) || 20, 100);
  if (q.get("board") === "smart") {
    const sm = await smartMoney();
    return {
      board: "nansen-smart-money",
      source: "Nansen, Monad, 30 days",
      available: !!sm,
      rows: (sm?.wallets ?? []).slice(0, limit).map((w, i) => ({ rank: i + 1, address: w.address, label: w.label, pnl30dUsd: round(w.totalPnlUsd), realizedUsd: round(w.realizedPnlUsd), unrealizedUsd: round(w.unrealizedPnlUsd), winRatePct: Math.round(w.winRatePct), trades: w.trades, topTokens: w.topTokens.map((t) => t.symbol) })),
    };
  }
  if (q.get("board") === "kadd") {
    const period = (q.get("period") ?? "7") as Period;
    if (!["1", "7", "30"].includes(period)) throw new BadRequest("period must be 1, 7 or 30 (days)");
    const b = await getLeaderboard();
    const rows = (q.get("of") === "clubs" ? b.clubs : b.traders)[period];
    return {
      board: "kadd-testnet",
      periodDays: Number(period),
      rows: rows.slice(0, limit).map((r, i) => ({ rank: i + 1, address: r.address, name: r.name ?? r.nns, pnlUsd: round(r.pnl), roiPct: round(r.roi), winRatePct: r.win, volumeUsd: round(r.volume), trades: r.trades })),
    };
  }
  const sort = (q.get("sort") ?? "volume") as (typeof SORTS)[number];
  if (!SORTS.includes(sort)) throw new BadRequest(`sort must be one of ${SORTS.join(", ")}`);
  const b = await getMainnetBoard();
  const minTrades = Math.max(Number(q.get("minTrades")) || 1, 1);
  const rows = b.rows.filter((r) => r.trades >= minTrades).sort((x, y) => y[sort] - x[sort]).slice(0, limit);
  return {
    board: "monad-mainnet",
    windowHours: b.since ? round((Date.now() - b.since) / 36e5, 1) : null,
    sort,
    minTrades,
    rows: rows.map((r, i) => ({
      rank: i + 1,
      address: r.address,
      nadName: r.nns,
      nansenSmartMoney: r.smart !== null,
      volumeUsd: round(r.volume),
      trades: r.trades,
      buys: r.buys,
      sells: r.sells,
      netFlowUsd: round(r.net),
      copyRoiPct: round(r.copyRoi),
      copyPnlUsd: round(r.copyPnl),
      tokens: r.tokens.map((t) => t.symbol),
      lastTradeAt: new Date(r.lastAt).toISOString(),
    })),
  };
}

export async function stats() {
  const s = await getStats();
  return {
    network: "monad-testnet",
    staleSince: s.staleSince ? new Date(s.staleSince).toISOString() : null,
    activity: s.activity && { trades: s.activity.trades, volumeUsd: round(s.activity.volume), uniqueWallets: s.activity.traders, clubDeposits: s.activity.deposits, trades24h: s.activity.hourly.trades.reduce((a, b) => a + b, 0) },
    poolLiquidityUsd: Math.round(s.poolLiquidity),
    clubs: s.clubs,
    clubTvlUsd: round(s.clubTvl),
    strategies: s.strategies,
    faucetClaims: s.faucetClaims,
    markets: s.pools.map((p) => ({ symbol: p.symbol, mainnetToken: p.source, pool: p.pool, testnetPriceUsd: sig(p.price), mainnetPriceUsd: p.mainnetPrice && sig(p.mainnetPrice), change24hPct: p.change24h, liquidityUsd: Math.round(p.liquidity), trades: p.trades, volumeUsd: p.volume })),
  };
}

const needAddress = (q: URLSearchParams, key: string) => {
  const v = q.get(key) ?? "";
  if (!isAddress(v, { strict: false })) throw new BadRequest(`${key} must be a 0x address`);
  return getAddress(v);
};
const balanceOf = (token: Address, who: Address) => publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [who] });
const allowance = (token: Address, who: Address, spender: Address) => publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [who, spender] });

/** A step-by-step `cast` plan for one testnet swap on the token's Kadd mirror pool. */
export async function trade(q: URLSearchParams) {
  const source = needAddress(q, "token");
  const from = needAddress(q, "from");
  const side = q.get("side");
  if (side !== "buy" && side !== "sell") throw new BadRequest("side must be buy or sell");
  const amount = Number(q.get("amount"));
  if (!(amount > 0) || (side === "sell" && amount > 100)) throw new BadRequest(side === "buy" ? "amount = tUSDC to spend, above 0" : "amount = % of your position to sell, 1-100");
  const slippageBps = BigInt(Math.min(Math.max(Number(q.get("slippageBps")) || 100, 1), 5000));

  const steps: { why: string; cmd: string }[] = [];
  const pool = await publicClient.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "poolOf", args: [source] });
  if (pool === zeroAddress) {
    if (side === "sell") throw new BadRequest("There's no Kadd pool for this token yet, so there's nothing to sell.");
    const q2 = (await quotes([source]))[source.toLowerCase()];
    if (!q2?.price) throw new BadRequest("No mainnet price for this token, so a testnet pool can't be opened.");
    const baseSeed = parseUnits((SEED_USD / q2.price).toFixed(6), 18);
    steps.push({ why: `Open the Kadd testnet pool for ${q2.symbol} at its mainnet price ($${sig(q2.price)})`, cmd: castSend(VENUE, "createMirror(address,string,string,uint256)", [source, q2.symbol, q2.symbol, baseSeed]) });
    return { network: "monad-testnet", status: "needs-pool", steps, next: "Run the step, then request this plan again for the swap itself." };
  }

  const [base, priceRaw] = await Promise.all([
    publicClient.readContract({ address: pool, abi: kaddPoolAbi, functionName: "baseToken" }),
    publicClient.readContract({ address: pool, abi: kaddPoolAbi, functionName: "price" }),
  ]);
  const tokenIn = side === "buy" ? TUSDC : base;
  let amountIn: bigint;
  if (side === "buy") {
    amountIn = parseUnits(amount.toFixed(6), 6);
    const bal = await balanceOf(TUSDC, from);
    if (bal < amountIn) steps.push({ why: `You hold ${formatUnits(bal, 6)} tUSDC. Claim 1,000 free (once an hour)`, cmd: castSend(TUSDC, "faucet()", []) });
  } else {
    const held = await balanceOf(base, from);
    amountIn = (held * BigInt(Math.round(amount * 100))) / 10_000n;
    if (amountIn === 0n) throw new BadRequest("This wallet holds none of this token on Kadd testnet.");
  }
  if ((await allowance(tokenIn, from, pool)) < amountIn) steps.push({ why: `Let the pool pull your ${side === "buy" ? "tUSDC" : "tokens"}`, cmd: castSend(tokenIn, "approve(address,uint256)", [pool, amountIn]) });
  const out = await publicClient.readContract({ address: pool, abi: kaddPoolAbi, functionName: "quote", args: [side === "buy", amountIn] });
  const minOut = (out * (10_000n - slippageBps)) / 10_000n;
  steps.push({
    why: `Swap: ${side === "buy" ? `${amount} tUSDC → ~${sig(Number(formatUnits(out, 18)))} tokens` : `${amount}% of your tokens → ~${sig(Number(formatUnits(out, 6)))} tUSDC`} (min ${Number(slippageBps) / 100}% slippage)`,
    cmd: castSend(pool, "swapExact(bool,uint256,uint256,uint64,address)", [side === "buy" ? "true" : "false", amountIn, minOut, "$(($(date +%s)+300))", from]),
  });
  return {
    network: "monad-testnet",
    status: "ready",
    pool,
    testnetPriceUsd: sig(Number(priceRaw) / 1e6),
    amountIn: amountIn.toString(),
    expectedOut: out.toString(),
    minOut: minOut.toString(),
    steps,
    note: "Run the steps in order with your own testnet key in $KADD_PRIVATE_KEY. Quotes move; request a fresh plan if a step fails with Slippage.",
  };
}

/** Auto copy: a plan to start a vault, or the vaults an owner has. */
export async function copy(q: URLSearchParams) {
  if (/^0x0+$/.test(COPY)) throw new BadRequest("Auto copy isn't deployed on this Kadd instance.");
  const c = { address: COPY, abi: kaddCopyAbi } as const;
  if (q.get("owner")) {
    const owner = needAddress(q, "owner");
    const ids = await publicClient.readContract({ ...c, functionName: "idsOf", args: [owner] });
    const rows = ids.length ? await publicClient.multicall({ allowFailure: false, contracts: ids.map((id) => ({ ...c, functionName: "get", args: [id] }) as const) }) : [];
    return {
      owner,
      vaults: rows.map((f, i) => ({
        id: Number(ids[i]),
        leader: f.leader,
        active: f.active,
        perTradeUsd: Number(formatUnits(f.perTrade, 6)),
        dailyCapUsd: Number(formatUnits(f.dailyCap, 6)),
        cashUsd: Number(formatUnits(f.cash, 6)),
        spentTodayUsd: Number(formatUnits(f.spentToday, 6)),
        copySells: f.copySells,
        since: new Date(Number(f.since) * 1000).toISOString(),
        stopCmd: f.active ? castSend(COPY, "close(uint256)", [ids[i]]) : null,
      })),
    };
  }
  const leader = needAddress(q, "leader");
  const from = needAddress(q, "from");
  const perTrade = Number(q.get("perTrade") ?? 10);
  const dailyCap = Number(q.get("dailyCap") ?? 50);
  const deposit = Number(q.get("deposit") ?? 100);
  const sells = q.get("sells") !== "false";
  if (!(perTrade > 0) || dailyCap < perTrade || !(deposit > 0)) throw new BadRequest("perTrade > 0, dailyCap >= perTrade, deposit > 0 (all in tUSDC)");
  const [p, d, dep] = [perTrade, dailyCap, deposit].map((n) => parseUnits(n.toFixed(6), 6));
  const steps: { why: string; cmd: string }[] = [];
  const bal = await balanceOf(TUSDC, from);
  if (bal < dep) steps.push({ why: `You hold ${formatUnits(bal, 6)} tUSDC. Claim 1,000 free (once an hour)`, cmd: castSend(TUSDC, "faucet()", []) });
  if ((await allowance(TUSDC, from, COPY)) < dep) steps.push({ why: "Let the copy vault take your deposit", cmd: castSend(TUSDC, "approve(address,uint256)", [COPY, dep]) });
  steps.push({
    why: `Start copying ${leader}: ${perTrade} tUSDC per buy, max ${dailyCap}/day, ${sells ? "exits when it sells" : "buys only"}, deposit ${deposit}`,
    cmd: castSend(COPY, "follow(address,uint128,uint128,bool,uint128)", [leader, p, d, sells ? "true" : "false", dep]),
  });
  return {
    network: "monad-testnet",
    contract: COPY,
    steps,
    trust: "The keeper decides when to copy; the contract enforces the pool, per-trade and daily limits, one copy per leader trade, and lets you close anytime.",
  };
}
