import { Activity, Radio } from "lucide-react";
import { trenchesSnapshot } from "@/lib/market";
import { getMainnetBoard, recentTrades, type WalletTrade } from "@/lib/wallets";
import { smartMoney } from "@/lib/nansen";
import { perpBoard } from "@/lib/perpl";
import { getLeaderboard } from "@/lib/leaderboard";
import AutoRefresh from "@/components/AutoRefresh";
import Onboarding from "@/components/Onboarding";
import Workspace from "@/components/home/Workspace";
import TrendingPane from "@/components/home/TrendingPane";
import BoardPane, { type BoardEntry } from "@/components/home/BoardPane";
import Pane from "@/components/home/Pane";
import TradePost, { type Post } from "@/components/home/TradePost";

export const revalidate = 30;

const TOP = 25;

export default async function Page() {
  const [hot, fresh, top, recent, board, smart, perps, kadd] = await Promise.all([
    trenchesSnapshot("hot"),
    trenchesSnapshot("new"),
    trenchesSnapshot("top"),
    recentTrades().catch(() => ({ trades: [] as WalletTrade[], failed: true })),
    getMainnetBoard(),
    smartMoney(),
    perpBoard().catch(() => null),
    getLeaderboard().catch(() => null),
  ]);

  // Who's who: .nad names and avatars from the mainnet board, Nansen labels for smart money.
  const known = new Map(board.rows.map((r) => [r.address, r]));
  const nansen = new Map(smart?.wallets.map((w) => [w.address, w]));
  const leaders = new Set(board.rows.slice(0, 20).map((r) => r.address)); // busiest wallets in the window
  const post = (t: WalletTrade): Post => {
    const k = known.get(t.trader);
    const n = nansen.get(t.trader);
    return { ...t, name: k?.nns ?? n?.label ?? null, avatar: k?.avatar ?? null, tag: n ? "Smart money" : leaders.has(t.trader) ? "Top trader" : null };
  };

  // Calls: the biggest buys by smart money and the busiest traders; failing those, the biggest buys overall.
  const trades = recent.trades.filter((t) => t.usd >= 1); // dust (fractions of a cent) is noise, not a signal
  const buys = trades.filter((t) => t.side === "buy");
  const picked = buys.filter((t) => nansen.has(t.trader) || leaders.has(t.trader));
  const calls = (picked.length ? picked : buys).sort((a, b) => b.usd - a.usd).slice(0, 30).map(post);
  const latest = trades.slice(0, 40).map(post);

  const boards: Record<"smart" | "perps" | "kadd", BoardEntry[]> = {
    smart: (smart?.wallets ?? []).toSorted((a, b) => b.totalPnlUsd - a.totalPnlUsd).slice(0, TOP).map((w) => ({ address: w.address, name: known.get(w.address)?.nns ?? w.label, avatar: known.get(w.address)?.avatar ?? null, pnl: w.totalPnlUsd, href: `/wallet/${w.address}` })),
    // All-time PnL needs the indexer; without it, rank by open (unrealized) PnL instead.
    perps: (perps?.rows ?? []).map((r) => ({ address: r.address, name: null, avatar: null, pnl: perps?.history ? (r.allTime ?? 0) : r.unrealized, href: `/wallet/${r.address}#perps` })).toSorted((a, b) => b.pnl - a.pnl).slice(0, TOP),
    kadd: (kadd?.traders["7"] ?? []).slice(0, TOP).map((r) => ({ address: r.address, name: r.nns, avatar: r.avatar, pnl: r.pnl, href: `/wallet/${r.address}` })),
  };

  const unavailable = <p className="p-6 text-center text-muted">Trades are unavailable right now. Retrying every 30 seconds.</p>;
  return (
    <div className="flex flex-col md:h-full">
      <AutoRefresh />
      <div className="empty:hidden shrink-0 p-2 md:p-3 border-b border-line">
        <Onboarding />
      </div>
      <div className="md:flex-1 md:min-h-0">
        <Workspace
          panes={[
            { key: "trending", title: "Trending", node: <TrendingPane lists={{ hot, new: fresh, top }} /> },
            {
              key: "calls",
              title: "Smart money calls",
              node: (
                <Pane icon={<Radio />} title="Smart money calls" meta="Biggest buys · Monad mainnet">
                  {calls.length ? calls.map((p) => <TradePost key={p.tx + p.token.address} p={p} />) : unavailable}
                </Pane>
              ),
            },
            { key: "board", title: "Leaderboard", node: <BoardPane boards={boards} perpsNote={perps?.history ? undefined : "Perpl · open PnL"} /> },
            {
              key: "latest",
              title: "Latest trades",
              node: (
                <Pane icon={<Activity />} title="Latest trades" meta="Newest first · Monad mainnet">
                  {latest.length ? latest.map((p) => <TradePost key={p.tx + p.token.address} p={p} />) : unavailable}
                </Pane>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
