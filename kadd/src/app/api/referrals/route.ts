import { isAddress } from "viem";
import { kaddLogs, referralsFrom } from "@/lib/events";

/** Wallets `?ref=0x..` invited onchain, and how many of them went on to trade. */
export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("ref") ?? "";
  if (!isAddress(ref, { strict: false })) return Response.json({ error: "ref must be an address" }, { status: 400 });
  const logs = await kaddLogs().catch(() => null);
  const r = logs ? referralsFrom(logs).get(ref.toLowerCase()) : undefined;
  return Response.json({ invited: r?.invited.length ?? 0, active: r?.active.length ?? 0 });
}
