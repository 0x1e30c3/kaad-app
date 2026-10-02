import { quotes } from "@/lib/market";

/** Live price / market cap / 24h change for `?a=0x..,0x..` (max 30). */
export async function GET(req: Request) {
  const list = (new URL(req.url).searchParams.get("a") ?? "").split(",").filter(Boolean);
  try {
    return Response.json(await quotes(list));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Quotes failed" }, { status: 502 });
  }
}
