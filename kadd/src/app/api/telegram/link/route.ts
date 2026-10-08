import { isAddress } from "viem";
import { getSub, saveSub, TELEGRAM_READY } from "@/lib/telegram";

const BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT;

/**
 * POST { token?, owner?, following[] } → creates or updates a Telegram subscription and returns the bot link to
 * connect it. The token is the subscription's secret; the browser keeps it to update the followed wallets later.
 */
export async function POST(req: Request) {
  if (!TELEGRAM_READY || !BOT_NAME) return Response.json({ error: "Telegram alerts aren't set up" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { token?: string; owner?: string; following?: string[] };
  const owner = body.owner && isAddress(body.owner, { strict: false }) ? body.owner.toLowerCase() : null;
  const following = (body.following ?? []).filter((a) => isAddress(a, { strict: false })).map((a) => a.toLowerCase()).slice(0, 50);
  const token = body.token && /^[0-9a-f]{32}$/.test(body.token) ? body.token : Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex");
  const prev = await getSub(token);
  await saveSub(token, { chat: prev?.chat ?? null, seen: prev?.seen ?? null, owner, following });
  return Response.json({ token, connected: !!prev?.chat, url: `https://t.me/${BOT_NAME}?start=${token}` });
}
