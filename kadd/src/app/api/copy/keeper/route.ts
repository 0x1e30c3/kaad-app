import { runKeeper } from "@/lib/keeper";
import { dispatchTelegram } from "@/lib/telegram";

// Triggered by a cron and by open app pages. Safe to call publicly: KaddCopy copies each leader trade at most once
// and enforces every limit; the keeper itself runs at most once per 20 seconds. The same tick sends Telegram alerts.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [keeper, telegram] = await Promise.all([runKeeper(), dispatchTelegram().catch((e) => ({ error: (e as Error).message.split("\n")[0] }))]);
    return Response.json({ ...keeper, telegram });
  } catch (e) {
    return Response.json({ ran: false, error: e instanceof Error ? e.message.split("\n")[0] : "Keeper failed" }, { status: 502 });
  }
}
