import { hot, searchTokens } from "@/lib/market";

/** Token search for the header box. Empty query → what's hot right now. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  try {
    return Response.json((await (q ? searchTokens(q) : hot())).slice(0, 8));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Search failed" }, { status: 502 });
  }
}
