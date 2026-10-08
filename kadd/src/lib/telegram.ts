// Telegram alerts that work with every tab closed: trades by wallets you follow and trades copied into your vaults and
// copy clubs. The browser links a subscription (secret token → owner + followed wallets) and the user taps Start in
// the bot; the keeper cron then sends whatever is new. State lives in KV (lib/kv.ts).
import "server-only";
import { kv, KV_READY } from "./kv";
import { copyActivity } from "./share";
import { getFeed } from "./wallets";
import { short, usd } from "./mock";

const BOT = process.env.TELEGRAM_BOT_TOKEN;
export const TELEGRAM_READY = !!BOT && KV_READY;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kaad-app.vercel.app";

export type Sub = { chat: number | null; owner: string | null; following: string[]; seen: string[] | null };
const SUBS = "tg:subs";
const subKey = (token: string) => `tg:sub:${token}`;

export async function bot(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${BOT}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`telegram ${method}: ${r.status} ${await r.text()}`);
}

export const getSub = async (token: string) => JSON.parse((await kv<string | null>("GET", subKey(token))) ?? "null") as Sub | null;
export const saveSub = async (token: string, s: Sub) => {
  await kv("SET", subKey(token), JSON.stringify(s));
  await kv("SADD", SUBS, token);
};
export const dropSub = async (token: string) => {
  await kv("DEL", subKey(token));
  await kv("SREM", SUBS, token);
};

/** New items (newest first) not in `seen`. The first pass after linking (seen === null) only records history. */
export function fresh<T extends { tx: string }>(items: T[], seen: string[] | null): { send: T[]; seen: string[] } {
  const known = new Set(seen ?? []);
  return { send: seen === null ? [] : items.filter((x) => !known.has(x.tx)), seen: [...new Set([...items.map((x) => x.tx), ...known])].slice(0, 300) };
}

/** Message lines for one batch: each item, or a summary past 3 so a backlog never floods the chat. */
export function lines(items: string[]): string[] {
  return items.length > 3 ? [`${items.length} new:\n${items.slice(0, 3).join("\n")}\n…`] : items;
}

let lastRun = 0;
/** One pass over every linked subscription. At most once per 50 s per server instance. */
export async function dispatchTelegram(): Promise<{ sent: number } | null> {
  if (!TELEGRAM_READY || Date.now() - lastRun < 50_000) return null;
  lastRun = Date.now();
  let sent = 0;
  // ponytail: sequential over all subs; batch or shard past a few hundred subscribers.
  for (const token of await kv<string[]>("SMEMBERS", SUBS)) {
    const s = await getSub(token);
    if (!s?.chat) continue;
    const [feed, copies] = await Promise.all([s.following.length ? getFeed(s.following).catch(() => []) : [], s.owner ? copyActivity(s.owner).catch(() => []) : []]);
    const items = [
      ...feed.map((t) => ({ tx: t.tx, text: `👀 ${t.nns ?? short(t.trader)} ${t.side === "buy" ? "bought" : "sold"} ${usd(t.usd)} of ${t.token.symbol}\n${SITE}/wallet/${t.trader}` })),
      ...copies.map((c) => ({ tx: c.tx, text: `🤖 ${c.label} copied a ${c.isBuy ? "buy" : "sell"}: ${usd(c.usd)} of ${c.symbol}` })),
    ];
    const f = fresh(items, s.seen);
    for (const text of lines(f.send.map((x) => x.text))) {
      await bot("sendMessage", { chat_id: s.chat, text, link_preview_options: { is_disabled: true } }).catch((e) => console.error("[telegram]", e));
      sent++;
    }
    if (f.send.length || s.seen === null) await saveSub(token, { ...s, seen: f.seen });
  }
  return { sent };
}
