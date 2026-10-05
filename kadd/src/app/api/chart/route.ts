import { TIMEFRAMES, isAddress, ohlcv, type Timeframe } from "@/lib/market";
import { chainOhlcv } from "@/lib/onchain";

/** Candles for one timeframe: GeckoTerminal (cached for everyone), or chain swaps when it's rate-limiting. */
async function candles(pool: string, token: string, tf: Timeframe) {
  try {
    return { ...(await ohlcv(pool, token, tf)), source: "geckoterminal" as const };
  } catch (e) {
    const chain = await chainOhlcv(pool, token, tf).catch(() => null);
    if (chain) return chain;
    throw e;
  }
}

/** Gap-filled USD candles for a token in a pool: `?pool=&token=&tf=1m|5m|15m|1h|4h|1d|auto`. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const pool = q.get("pool") ?? "";
  const token = (q.get("token") ?? "").toLowerCase();
  const tf = q.get("tf") ?? "auto";
  if (!/^0x[0-9a-f]{40}([0-9a-f]{24})?$/i.test(pool) || !isAddress(token) || (tf !== "auto" && !(tf in TIMEFRAMES)))
    return Response.json({ error: "Bad pool, token or timeframe" }, { status: 400 });
  try {
    let data;
    if (tf === "auto") {
      // The shortest timeframe where at least half the candles in view have trades, so quiet tokens don't open on a
      // chart that's mostly flat lines.
      for (const t of ["5m", "15m", "1h", "4h", "1d"] as const) {
        data = await candles(pool, token, t);
        if (data.trades >= data.candles.length / 2) break;
      }
    } else data = await candles(pool, token, tf as Timeframe);
    return Response.json(data, { headers: { "cache-control": "public, max-age=10" } });
  } catch {
    return Response.json({ error: "Chart data is briefly unavailable" }, { status: 502 });
  }
}
