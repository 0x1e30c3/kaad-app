import { runKeeper } from "@/lib/keeper";
import { dispatchTelegram } from "@/lib/telegram";
import { runPerplBot } from "@/lib/perplBot";

// Triggered by a cron and by open app pages. Safe to call publicly: KaddCopy copies each leader trade at most once
// and enforces every limit; the keeper itself runs at most once per 20 seconds. The same tick sends Telegram alerts and runs the Perpl copy bot.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fail = (e: unknown) => ({ error: (e as Error).message.split("\n")[0] });
    const [keeper, telegram, perpl] = await Promise.all([runKeeper(), dispatchTelegram().catch(fail), runPerplBot().catch(fail)]);
    return Response.json({ ...keeper, telegram, perpl });
  } catch (e) {
    return Response.json({ ran: false, error: e instanceof Error ? e.message.split("\n")[0] : "Keeper failed" }, { status: 502 });
  }
}
