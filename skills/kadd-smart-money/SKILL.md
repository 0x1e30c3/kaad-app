---
name: kadd-smart-money
description: Ranks the wallets trading Monad memecoins right now — by volume, trade count, net flow, recency, or Copy ROI (a backtest of copying each wallet $10 per buy) — Nansen-labelled smart money on Monad with real 30-day PnL, and the Kadd testnet PnL leaderboard for traders and clubs, via the Kadd agent API. Use when the user asks "who's trading Monad now", "smart money on Monad", "best wallets to copy", "top traders", "leaderboard", "siapa trader terbaik", "wallet mana yang layak di-copy", "whale Monad". For one wallet's detail use kadd-wallet.
argument-hint: "[volume|copyRoi|trades|net|lastAt] [limit] | kadd [1|7|30]"
---

# Smart money and leaderboards

Read-only. Three boards:

- **Monad mainnet** (default): real wallets from the latest ~300 trades per pool of the tokens Kadd lists. A window
  of hours. No PnL — use `copyRoiPct` (backtest) and `netFlowUsd`.
- **Nansen smart money**: wallets Nansen labels as smart money on Monad, with real 30-day PnL (realized +
  unrealized), win rate and trades across all their Monad trades. Refreshed daily. The best answer to "who is
  actually profitable".
- **Kadd testnet**: PnL from swaps on Kadd's testnet venue over 1, 7 or 30 days, for traders or clubs.

## Setup

`KADD_API` = the Kadd deployment's base URL (no trailing slash). Ask once if unset; local dev is
`http://localhost:3123`.

Shell state may not persist between your commands, so put the base inline when needed:
`KADD_API=http://localhost:3123; curl -s "$KADD_API/..."`. `GET $KADD_API/api/agent/help` lists every endpoint.

## Commands

```bash
# Mainnet: sort = volume | copyRoi | trades | net | lastAt; minTrades drops wallets with fewer trades
curl -s "$KADD_API/api/agent/leaderboard?sort=copyRoi&minTrades=5&limit=20"

# Nansen smart money on Monad (30-day PnL)
curl -s "$KADD_API/api/agent/leaderboard?board=smart&limit=20"

# Kadd testnet PnL: period = 1 | 7 | 30 days, of = traders | clubs
curl -s "$KADD_API/api/agent/leaderboard?board=kadd&period=7&of=traders"
```

"Most profitable / smart money / who's winning" → `board=smart` first. Otherwise choose `sort` from the ask: "worth copying / best to follow" → `copyRoi`; "whales / biggest" → `volume`; "most
active / bots" → `trades`; "taking profit / dumping" → `net`; "right now / just traded" → `lastAt`.

## Response

Mainnet: `{ board, windowHours, sort, minTrades, rows[] }`. Each row: `rank`, `address`, `nadName`, `volumeUsd`,
`trades`, `buys`, `sells`, `netFlowUsd` (USD sold − bought), `copyRoiPct` / `copyPnlUsd` (backtest of copying it
$10 per buy; sorted by `sort=copyRoi`), `tokens` (symbols), `lastTradeAt` (ISO, UTC).

Mainnet rows also carry `nansenSmartMoney` (true when Nansen labels the wallet as smart money).

Nansen: `{ board, source, available, rows[] }` with `rank`, `address`, `label` (Nansen's label, may be null),
`pnl30dUsd`, `realizedUsd`, `unrealizedUsd`, `winRatePct`, `trades`, `topTokens`. `available: false` = Nansen isn't
reachable; use the mainnet board instead.

Kadd testnet: `{ board, periodDays, rows[] }` with `rank`, `address`, `name` (club or `.nad` name), `pnlUsd`,
`roiPct`, `winRatePct`, `volumeUsd`, `trades`.

## How to answer

1. A table: rank, name (`nadName` or short address), the sort metric first, then volume, trades, buys/sells, tokens,
   last trade.
2. For "worth copying", always pass `minTrades=5` (drop to 3 if that leaves under 5 rows, and say you did). Copy ROI
   from one or two trades is noise. Among the remaining rows, prefer the one with more trades, more than one token,
   and both buys and sells, over a slightly higher ROI — and say why you picked it.
3. Offer the next step on the best one or two: kadd-wallet for the full profile and copy backtest, then kadd-trade
   (auto copy) to follow it with contract-enforced limits. For Nansen smart money this is the point: Nansen says who
   is profitable, Kadd lets the user test and follow them safely.
4. An empty Kadd testnet board just means nobody has traded on Kadd in that period yet.

Addresses only — never guess who owns a wallet. Not financial advice.
