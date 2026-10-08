"use client";
import { useEffect } from "react";
import type { FeedItem } from "@/lib/wallets";
import type { CopyActivity } from "@/lib/share";
import { short, usd } from "@/lib/mock";
import { toast, useStore } from "@/lib/store";
import { linkTelegram, tgToken } from "@/lib/telegramLink";
import { fetchPerpMarkets, myPositions, perpAccount, type PerpNet } from "@/lib/perplTrade";
import { liqDistance } from "@/lib/perplRisk";

const SEEN = "kadd:seen:"; // + stream: tx hashes already announced, shared by every open tab
const seen = (k: string): string[] | null => {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN + k) ?? "null");
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};
const markSeen = (k: string, ids: string[]) => {
  try {
    localStorage.setItem(SEEN + k, JSON.stringify(ids.slice(0, 300)));
  } catch {}
};

export const notify = (title: string, body: string) => {
  toast(body);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, icon: "/icon.png" });
};

/** Announces items (newest first) not seen before. The first poll only records them, so old history never fires. */
export function announce<T extends { tx: string }>(stream: string, items: T[], line: (x: T) => string, title: string) {
  if (!items.length) return;
  const last = seen(stream);
  const known = new Set(last ?? []);
  const fresh = items.filter((x) => !known.has(x.tx));
  markSeen(stream, [...new Set([...items.map((x) => x.tx), ...known])]);
  if (last === null || !fresh.length) return;
  if (fresh.length > 3) return notify(title, `${fresh.length} new: ${fresh.slice(0, 2).map(line).join(", ")}…`);
  for (const x of fresh) notify(title, line(x));
}

/** Bands a position is in when it's close to liquidation (as a share of the price left), or null when it's safe. */
const band = (d: number) => (d < 0.02 ? "2" : d < 0.05 ? "5" : null);

/**
 * My Perpl positions (testnet and mainnet) closer than 5%, then 2%, to liquidation: one alert per position per band.
 * A position that moves back out of a band can alert again later.
 */
async function watchLiquidations(me: `0x${string}`) {
  const alerted = new Set(seen("liq") ?? []);
  const now = new Set<string>();
  for (const net of ["testnet", "mainnet"] as PerpNet[]) {
    const acct = await perpAccount(net, me).catch(() => null);
    if (!acct?.accountId) continue;
    const markets = await fetchPerpMarkets(net).catch(() => []);
    for (const p of await myPositions(net, acct.accountId, markets).catch(() => [])) {
      const d = liqDistance(p.side, p.mark, p.liquidation);
      const b = band(d);
      if (!b) continue;
      const key = `${net}:${p.market.id}:${p.side}:${b}`;
      now.add(key);
      if (!alerted.has(key)) notify("Liquidation risk", `${p.side === "long" ? "Long" : "Short"} ${p.market.name} on Perpl ${net} is ${(d * 100).toFixed(1)}% from liquidation (${p.leverage.toFixed(1)}×). Add margin or reduce it on /perps.`);
    }
  }
  markSeen("liq", [...now]);
}

/**
 * Every 60 s while Kadd is open: new trades by followed wallets, trades copied into my vaults, and my Perpl positions
 * nearing liquidation, as a toast plus a system notification when allowed. ponytail: polling, not web push — nothing
 * fires with every tab closed (Telegram covers that).
 */
export default function ActivityWatcher() {
  const { following, user } = useStore();
  const key = following.join(",");
  const owner = user?.address;
  // Linked to Telegram? Keep its followed wallets and owner in sync with this browser.
  useEffect(() => {
    if (tgToken()) linkTelegram(owner, key ? key.split(",") : []).catch(() => {});
  }, [key, owner]);
  useEffect(() => {
    if (!owner) return;
    watchLiquidations(owner).catch(() => {});
    const id = setInterval(() => watchLiquidations(owner).catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, [owner]);
  useEffect(() => {
    const poll = async () => {
      if (key) {
        const feed: FeedItem[] = await fetch(`/api/feed?w=${key}`).then((r) => (r.ok ? r.json() : []), () => []);
        announce("feed", feed, (t) => `${t.nns ?? short(t.trader)} ${t.side === "buy" ? "bought" : "sold"} ${usd(t.usd)} of ${t.token.symbol}`, "Followed wallet traded");
      }
      if (owner) {
        const copies: CopyActivity[] = await fetch(`/api/copy/activity?owner=${owner}`).then((r) => (r.ok ? r.json() : []), () => []);
        announce(`copy:${owner.toLowerCase()}`, copies, (c) => `${c.label} copied a ${c.isBuy ? "buy" : "sell"}: ${usd(c.usd)} of ${c.symbol}`, "Auto copy");
      }
    };
    poll();
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [key, owner]);
  return null;
}
