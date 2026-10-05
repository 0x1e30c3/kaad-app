import { BadRequest, copy, leaderboard, market, search, stats, token, trade, wallet } from "@/lib/agent";

// Public JSON API for AI agents (see /skills). GET only, read-only; trade and copy return `cast` plans to sign locally.
export const dynamic = "force-dynamic";

const HELP = {
  name: "Kadd agent API",
  endpoints: {
    "GET /api/agent/market?list=trending|hot|gainers|new|volume&limit=20": "Monad mainnet memecoin lists (hot = 1h activity, gainers = biggest 1h % move)",
    "GET /api/agent/search?q=<ticker|name|address>": "Find a token's address from its ticker or name",
    "GET /api/agent/token/<address>": "Token due diligence: price, liquidity, holders, risk score with reasons, recent trades",
    "GET /api/agent/wallet/<address>": "Wallet profile: recent trades, holdings, .nad name, copy backtest",
    "GET /api/agent/leaderboard?sort=volume|copyRoi|trades|net|lastAt&minTrades=1&limit=20": "Who's trading Monad memecoins now",
    "GET /api/agent/leaderboard?board=kadd&period=1|7|30&of=traders|clubs": "Kadd testnet PnL board",
    "GET /api/agent/leaderboard?board=smart": "Nansen-labelled smart money on Monad, by 30-day PnL",
    "GET /api/agent/stats": "Kadd testnet network stats and markets",
    "GET /api/agent/trade?token=<mainnet token>&side=buy|sell&amount=<tUSDC | %>&from=<your address>": "cast plan for a testnet swap",
    "GET /api/agent/copy?leader=<wallet>&from=<you>&perTrade=10&dailyCap=50&deposit=100&sells=true": "cast plan to start auto copy",
    "GET /api/agent/copy?owner=<you>": "Your auto copy vaults",
  },
};

export async function GET(req: Request, ctx: RouteContext<"/api/agent/[...path]">) {
  const [route, arg] = (await ctx.params).path;
  const q = new URL(req.url).searchParams;
  try {
    const data =
      route === "market" ? await market(q)
      : route === "token" ? await token(arg ?? "")
      : route === "wallet" ? await wallet(arg ?? "")
      : route === "leaderboard" ? await leaderboard(q)
      : route === "stats" ? await stats()
      : route === "search" ? await search(q)
      : route === "trade" ? await trade(q)
      : route === "copy" ? await copy(q)
      : HELP;
    if (data === null) return json({ error: "Token not found on Monad mainnet" }, 404);
    return json(data, data === HELP && route !== "help" ? 404 : 200);
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: e.message }, 400);
    console.error("agent api", route, e);
    return json({ error: "Upstream data unavailable right now. Retry in a minute." }, 502);
  }
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "access-control-allow-origin": "*", "cache-control": "no-store" } });
