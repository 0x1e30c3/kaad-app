import { isAddress } from "viem";
import { getFeed } from "@/lib/wallets";

/** Latest Monad mainnet trades by `?w=0x..,0x..` (max 50 wallets), for the Following feed. */
export async function GET(req: Request) {
  const list = (new URL(req.url).searchParams.get("w") ?? "").split(",").filter((a) => isAddress(a, { strict: false })).slice(0, 50);
  try {
    return Response.json(list.length ? await getFeed(list) : []);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Feed failed" }, { status: 502 });
  }
}
