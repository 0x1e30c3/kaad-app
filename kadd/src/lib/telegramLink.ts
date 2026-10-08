"use client";
// Browser side of Telegram alerts: keeps this browser's subscription token and pushes followed wallets to it.
export const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT || "";
const KEY = "kadd:tg";

export const tgToken = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/** Creates or updates this browser's subscription; returns the bot link. */
export async function linkTelegram(owner: string | undefined, following: string[]) {
  const r = await fetch("/api/telegram/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: tgToken(), owner, following }) });
  if (!r.ok) throw new Error("Telegram alerts aren't available right now");
  const j = (await r.json()) as { token: string; url: string; connected: boolean };
  try {
    localStorage.setItem(KEY, j.token);
  } catch {}
  return j;
}
