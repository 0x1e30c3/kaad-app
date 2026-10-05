// Nansen (api.nansen.ai): labelled smart-money wallets on Monad with their real 30-day PnL. Credits are scarce (free
// plan: 100 once, then 10/day), so there's exactly one paid call — the Monad smart-money PnL leaderboard, 5 credits —
// kept in Next's Data Cache for 24 hours (survives restarts, shared across server instances) and skipped during
// `next build` so deploys don't spend credits. Wallet pages and badges reuse that one response, so browsing never
// spends credits.
import "server-only";
import { swr } from "./cache";

const BASE = "https://api.nansen.ai/api/v1";
const REFRESH_SECONDS = 24 * 3600; // 5 credits/day: under the free plan's 10-credit daily top-up

export type SmartWallet = {
  address: string;
  label: string | null; // Nansen's label for the wallet, e.g. "High Activity", an ENS name
  totalPnlUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  winRatePct: number;
  trades: number;
  tokensTraded: number;
  openPositions: number;
  topTokens: { address: string; symbol: string; logo: string | null; usd: number }[];
};
export type SmartMoney = { wallets: SmartWallet[]; timeframeDays: number; fetchedAt: number } | null;

type Row = {
  address: string;
  address_label: string | null;
  total_pnl_usd: number;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number;
  win_rate: number;
  n_trades: number;
  n_tokens: number;
  open_trades: number;
  top_traded_tokens_info?: { token_address: string; symbol: string; logo: string | null; usd_value: string }[];
};

/** Monad smart-money wallets by 30-day PnL, or null when Nansen isn't configured or reachable. */
export const smartMoney = (): Promise<SmartMoney> =>
  swr("nansen:smart-money", 10 * 60_000, async () => {
    const key = process.env.NANSEN_API_KEY;
    if (!key || process.env.NEXT_PHASE === "phase-production-build") return null;
    const res = await fetch(`${BASE}/smart-money/pnl-leaderboard`, {
      method: "POST",
      headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ chains: ["monad"], timeframe: 30, pagination: { page: 1, per_page: 100 } }),
      cache: "force-cache",
      next: { revalidate: REFRESH_SECONDS },
    }).catch(() => null);
    if (!res?.ok) {
      console.error("nansen smart money failed", res?.status);
      return null;
    }
    const { data } = (await res.json()) as { data: Row[] };
    return {
      timeframeDays: 30,
      fetchedAt: Date.now(),
      wallets: data.map((r) => ({
        address: r.address.toLowerCase(),
        label: r.address_label || null,
        totalPnlUsd: r.total_pnl_usd,
        realizedPnlUsd: r.realized_pnl_usd,
        unrealizedPnlUsd: r.unrealized_pnl_usd,
        winRatePct: r.win_rate * 100,
        trades: r.n_trades,
        tokensTraded: r.n_tokens,
        openPositions: r.open_trades,
        topTokens: (r.top_traded_tokens_info ?? [])
          .filter((t) => !["MON", "WMON"].includes(t.symbol))
          .map((t) => ({ address: t.token_address.toLowerCase(), symbol: t.symbol, logo: t.logo, usd: Number(t.usd_value) || 0 })),
      })),
    };
  }).catch(() => null);

/** One wallet's Nansen smart-money entry, if it is one. Free: reads the cached leaderboard. */
export async function smartWallet(address: string): Promise<SmartWallet | null> {
  const sm = await smartMoney();
  return sm?.wallets.find((w) => w.address === address.toLowerCase()) ?? null;
}
