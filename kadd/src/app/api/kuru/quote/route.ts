import { kuruQuote } from "@/lib/kuru";

/** POST { user, tokenIn, tokenOut, amount, slippageBps? } → a Kuru Flow quote and the transaction to sign. */
export async function POST(req: Request) {
  const q = await req.json().catch(() => null);
  if (!q) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    return Response.json(await kuruQuote(q));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Quote failed" }, { status: 502 });
  }
}
