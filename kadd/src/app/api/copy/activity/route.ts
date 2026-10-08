import { isAddress } from "viem";
import { copyActivity } from "@/lib/share";

/** Trades copied into the vaults of `?owner=0x..`, newest first (for in-app notifications). */
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner") ?? "";
  if (!isAddress(owner, { strict: false })) return Response.json({ error: "owner must be an address" }, { status: 400 });
  try {
    return Response.json(await copyActivity(owner));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Activity failed" }, { status: 502 });
  }
}
