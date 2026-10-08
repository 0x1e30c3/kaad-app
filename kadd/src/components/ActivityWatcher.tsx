"use client";
import { useEffect } from "react";
import type { FeedItem } from "@/lib/wallets";
import type { CopyActivity } from "@/lib/share";
import { short, usd } from "@/lib/mock";
import { toast, useStore } from "@/lib/store";
import { linkTelegram, tgToken } from "@/lib/telegramLink";

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

/**
 * Every 60 s while Kadd is open: new trades by followed wallets and new trades copied into my vaults, as a toast plus
 * a system notification when allowed. ponytail: polling, not web push — nothing fires with every tab closed.
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
