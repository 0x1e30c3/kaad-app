import { smartMoney } from "@/lib/nansen";
import { perpBoard } from "@/lib/perpl";
import { short } from "@/lib/mock";

export type TickerItem = { address: string; name: string; pnl: number; note: string };

/** Biggest winners for the app's ticker strip: Nansen smart money on Monad (30d PnL) and Perpl traders, together. */
export async function GET() {
  const [sm, perps] = await Promise.all([smartMoney(), perpBoard().catch(() => null)]);
  const smart = (sm?.wallets ?? []).map((w) => ({ address: w.address, name: w.label ?? short(w.address), pnl: w.totalPnlUsd, note: "Smart money · 30d PnL (Nansen)" }));
  // All-time PnL needs the indexer; without it, open (unrealized) PnL.
  const perp = (perps?.rows ?? []).map((r) => ({ address: r.address, name: short(r.address), pnl: perps?.history ? (r.allTime ?? 0) : r.unrealized, note: perps?.history ? "Perpl · all-time PnL" : "Perpl · open PnL" }));
  const items: TickerItem[] = [...smart, ...perp].filter((w) => w.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 24);
  return Response.json(items, { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
