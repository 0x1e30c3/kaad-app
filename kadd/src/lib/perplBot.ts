// Kadd's perps copy bot: mirrors one Perpl trader on Monad mainnet with its own account on Perpl testnet, within a
// fixed budget and a leverage cap. It reconciles positions (target state), not individual fills, so a missed tick or a
// restart just catches up on the next one. Its API key is trade-only: Perpl never lets an API key withdraw.
import "server-only";
import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";
import { PERPL, perpMarkets, perpPositions, perplAbi, type PerpPosition } from "./perpl";

export type Side = "long" | "short";
export type Held = { market: string; side: Side; notional: number };
export type Intent = { market: string; action: "open" | "close"; side: Side; notional: number; leverage: number };
export type BotRules = { budget: number; maxLeverage: number; minUsd: number; band: number };

/**
 * Orders that move `mine` toward the leader's book scaled to `budget`: same markets and sides, notional scaled by
 * budget / leader equity, leverage capped at `maxLeverage`, total margin never above the budget. Differences under
 * `minUsd` or `band` (a share of the target) are left alone so the bot doesn't churn on every price tick.
 */
export function reconcile(leader: PerpPosition[], leaderEquity: number, mine: Held[], r: BotRules): Intent[] {
  const scale = leaderEquity > 0 ? r.budget / leaderEquity : 0;
  let targets = leader.map((p) => ({ market: p.market, side: p.side, notional: p.notional * scale, leverage: Math.max(1, Math.min(p.leverage, r.maxLeverage)) }));
  const margin = targets.reduce((s, t) => s + t.notional / t.leverage, 0);
  if (margin > r.budget) targets = targets.map((t) => ({ ...t, notional: (t.notional * r.budget) / margin }));

  const out: Intent[] = [];
  const markets = new Set([...targets.map((t) => t.market), ...mine.map((m) => m.market)]);
  for (const market of markets) {
    const t = targets.find((x) => x.market === market);
    const cur = mine.find((x) => x.market === market);
    const same = cur && t && cur.side === t.side;
    if (cur && !same) out.push({ market, action: "close", side: cur.side, notional: cur.notional, leverage: t?.leverage ?? 1 });
    if (!t) continue;
    const diff = t.notional - (same ? cur.notional : 0);
    if (Math.abs(diff) < Math.max(r.minUsd, r.band * t.notional)) continue;
    out.push({ market, action: diff > 0 ? "open" : "close", side: t.side, notional: Math.abs(diff), leverage: t.leverage });
  }
  return out;
}

// ---------------------------------------------------------------- Perpl testnet API (trade-only key)

const T = PERPL.testnet;
const env = () => ({
  key: process.env.PERPL_BOT_API_KEY,
  secret: process.env.PERPL_BOT_API_SECRET,
  leader: process.env.PERPL_BOT_LEADER?.toLowerCase(),
  rules: {
    budget: Number(process.env.PERPL_BOT_BUDGET_USD || 200),
    maxLeverage: Number(process.env.PERPL_BOT_MAX_LEVERAGE || 3),
    minUsd: 10,
    band: 0.2,
  } satisfies BotRules,
  paused: process.env.PERPL_BOT_PAUSED === "1",
});
export const PERPL_BOT_READY = () => !!(env().key && env().secret && env().leader);

// Ed25519 from the raw 32-byte secret, with node's own crypto (PKCS#8 prefix for an Ed25519 private key).
const keyOf = (hex: string) => createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(hex.replace(/^0x/, ""), "hex")]), format: "der", type: "pkcs8" });

async function api<R>(method: "GET" | "POST", target: string, body?: unknown): Promise<R> {
  const { key, secret } = env();
  const raw = body === undefined ? "" : JSON.stringify(body);
  const ts = Date.now().toString();
  const nonce = randomBytes(16).toString("base64url");
  const canonical = [T.chainId, method, target, ts, nonce, createHash("sha256").update(raw).digest("hex")].join("\n");
  const sig = sign(null, Buffer.from(canonical), keyOf(secret!)).toString("base64url");
  const res = await fetch(`${T.api}${target}`, {
    method,
    headers: { "X-API-Key": key!, "X-API-Timestamp": ts, "X-API-Nonce": nonce, "X-API-Signature": sig, ...(raw ? { "content-type": "application/json" } : {}) },
    body: raw || undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`perpl ${method} ${target}: ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text) as R;
}

type Wallet = { sn: number; addr: string; as: { id: number; fw: boolean; fr: boolean; lfr: number; b: string }[] };
type ApiPosition = { mkt: number; acc: number; sd: 1 | 2; s: number };
type Ticker = { sn: number; d: Record<string, { mrk: number }> };

/** The bot's own account and positions on Perpl testnet, valued at the testnet mark price. */
async function botState() {
  const [wallet, positions, ticker, markets] = await Promise.all([
    api<Wallet>("GET", "/v1/trading/wallet"),
    api<{ d: ApiPosition[] }>("GET", "/v1/trading/positions"),
    fetch(`${T.api}/v1/market-data/ticker`, { cache: "no-store" }).then((r) => r.json() as Promise<Ticker>),
    perpMarkets("testnet"),
  ]);
  const account = wallet.as[0];
  if (!account) throw new Error("the bot wallet has no Perpl testnet account yet: deposit AUSD on testnet.perpl.xyz first");
  const mark = (id: number) => {
    const m = markets.find((x) => x.id === id)!;
    return (ticker.d[String(id)]?.mrk ?? 0) / 10 ** m.priceDecimals;
  };
  const held: Held[] = positions.d
    .filter((p) => p.acc === account.id && p.s > 0)
    .map((p) => {
      const m = markets.find((x) => x.id === p.mkt)!;
      return { market: m.name, side: p.sd === 1 ? "long" : "short", notional: (p.s / 10 ** m.sizeDecimals) * mark(p.mkt) };
    });
  return { address: wallet.addr.toLowerCase(), account, held, head: ticker.sn, markets, mark };
}

/** The leader's open book on mainnet and its equity (margin in positions plus free balance). */
async function leaderState(leader: string) {
  const all = await perpPositions("mainnet");
  const book = all.filter((p) => p.address === leader);
  const account = book[0]?.account;
  const free = account
    ? Number((await PERPL.mainnet.client.readContract({ address: PERPL.mainnet.exchange, abi: perplAbi, functionName: "getAccountById", args: [BigInt(account)] })).balanceCNS) / 1e6
    : 0;
  return { book, equity: book.reduce((s, p) => s + p.deposit, 0) + free };
}

export type BotRun = { ran: boolean; reason?: string; orders?: { intent: Intent; code: number; error?: string }[] };
let lastRun = 0;

/** One reconcile pass: at most every 30 s per server instance. Safe to call from the keeper cron. */
export async function runPerplBot(): Promise<BotRun> {
  const e = env();
  if (!PERPL_BOT_READY()) return { ran: false, reason: "not configured" };
  if (e.paused) return { ran: false, reason: "paused" };
  if (Date.now() - lastRun < 30_000) return { ran: false, reason: "ran recently" };
  lastRun = Date.now();

  const [bot, lead] = await Promise.all([botState(), leaderState(e.leader!)]);
  if (!bot.account.fw) return { ran: false, reason: "enable One-Click Trading for the bot account on testnet.perpl.xyz" };
  const tradable = new Set(bot.markets.filter((m) => m.open).map((m) => m.name));
  const intents = reconcile(lead.book.filter((p) => tradable.has(p.market)), lead.equity, bot.held, e.rules);
  if (!intents.length) return { ran: true, orders: [] };

  let rq = bot.account.lfr;
  const specs = intents.map((i) => {
    const m = bot.markets.find((x) => x.name === i.market)!;
    const size = Math.round((i.notional / bot.mark(m.id)) * 10 ** m.sizeDecimals);
    return {
      rq: ++rq,
      mkt: m.id,
      acc: bot.account.id,
      t: i.action === "open" ? (i.side === "long" ? 1 : 2) : i.side === "long" ? 3 : 4,
      p: 0, // market
      s: size,
      fl: 4, // immediate or cancel
      lv: Math.round(i.leverage * 100),
      lb: bot.head + m.ttlBlocks,
    };
  });
  const sendable = specs.filter((s) => s.s > 0);
  if (!sendable.length) return { ran: true, orders: [] };
  const res = await api<{ statuses?: { code: number; error?: string }[] }>("POST", "/v1/trading/orders", { d: sendable });
  return { ran: true, orders: sendable.map((s, i) => ({ intent: intents[specs.indexOf(s)], code: res.statuses?.[i]?.code ?? -1, error: res.statuses?.[i]?.error })) };
}

export type BotView = { leader: string; bot: string | null; rules: BotRules; leaderBook: PerpPosition[]; botBook: PerpPosition[] };

/** What the copy bot follows and holds, for the public page. Reads both books from the contracts, no API key. */
export async function botView(): Promise<BotView | null> {
  const e = env();
  if (!e.leader) return null;
  const bot = process.env.PERPL_BOT_ADDRESS?.toLowerCase() ?? null;
  const [main, test] = await Promise.all([perpPositions("mainnet"), bot ? perpPositions("testnet") : Promise.resolve([])]);
  return { leader: e.leader, bot, rules: e.rules, leaderBook: main.filter((p) => p.address === e.leader), botBook: test.filter((p) => p.address === bot) };
}
