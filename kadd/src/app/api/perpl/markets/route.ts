import { perpMarkets, perpTickers } from "@/lib/perpl";

/** Perpl markets with their trading terms and live ticker, for `?net=testnet|mainnet` (default testnet). */
export async function GET(req: Request) {
  const net = new URL(req.url).searchParams.get("net") === "mainnet" ? "mainnet" : "testnet";
  try {
    const [markets, tickers] = await Promise.all([perpMarkets(net), perpTickers(net)]);
    return Response.json(markets.filter((m) => m.open).map((m) => ({ ...m, ticker: tickers[m.id] ?? null })));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Perpl unavailable" }, { status: 502 });
  }
}
