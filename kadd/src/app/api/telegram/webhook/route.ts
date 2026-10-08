import { bot, dropSub, getSub, saveSub, TELEGRAM_READY } from "@/lib/telegram";
import { kv } from "@/lib/kv";

/** Telegram bot webhook: "/start <token>" links this chat to a subscription, "/stop" unlinks it. */
export async function POST(req: Request) {
  if (!TELEGRAM_READY || req.headers.get("x-telegram-bot-api-secret-token") !== process.env.TELEGRAM_WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  const update = (await req.json().catch(() => ({}))) as { message?: { chat: { id: number }; text?: string } };
  const msg = update.message;
  if (!msg?.text) return Response.json({ ok: true });
  const chat = msg.chat.id;
  const [cmd, token] = msg.text.trim().split(/\s+/);
  const reply = (text: string) => bot("sendMessage", { chat_id: chat, text });

  if (cmd === "/start") {
    const sub = token && /^[0-9a-f]{32}$/.test(token) ? await getSub(token) : null;
    if (!sub) {
      await reply("Open Kadd and tap “Alerts on Telegram” to connect: https://kaad-app.vercel.app/groups");
      return Response.json({ ok: true });
    }
    const old = await kv<string | null>("GET", `tg:chat:${chat}`);
    if (old && old !== token) await dropSub(old); // one subscription per chat
    await saveSub(token, { ...sub, chat, seen: null });
    await kv("SET", `tg:chat:${chat}`, token);
    await reply(`Connected. You'll get a message when ${sub.following.length ? `one of the ${sub.following.length} wallets you follow trades` : "a wallet you follow trades"}${sub.owner ? " or Kadd copies a trade into your vaults and clubs" : ""}. Send /stop to turn alerts off.`);
  } else if (cmd === "/stop") {
    const t = await kv<string | null>("GET", `tg:chat:${chat}`);
    if (t) await dropSub(t);
    await kv("DEL", `tg:chat:${chat}`);
    await reply("Alerts off. Connect again from Kadd anytime.");
  }
  return Response.json({ ok: true });
}
