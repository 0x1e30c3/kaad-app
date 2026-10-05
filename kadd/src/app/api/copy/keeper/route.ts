import { runKeeper } from "@/lib/keeper";

// Triggered by a cron and by open app pages. Safe to call publicly: KaddCopy copies each leader trade at most once
// and enforces every limit; the keeper itself runs at most once per 20 seconds.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await runKeeper());
  } catch (e) {
    return Response.json({ ran: false, error: e instanceof Error ? e.message.split("\n")[0] : "Keeper failed" }, { status: 502 });
  }
}
