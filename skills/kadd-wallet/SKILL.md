---
name: kadd-wallet
description: Profiles a Monad wallet — its recent memecoin trades, volume, buys vs sells, net flow, current holdings, MON balance, .nad name, its PnL on Kadd testnet, and a copy-trading backtest (what copying it with $10 per buy would have returned) — via the Kadd agent API. Use when the user gives a wallet address or asks "analyze this wallet", "is this trader good", "should I copy this wallet", "cek wallet ini", "trader ini bagus nggak", "kalau aku copy wallet ini gimana". For a token contract address use kadd-token; to find wallets worth looking at use kadd-smart-money.
argument-hint: "<wallet_address>"
---

# Wallet profile and copy backtest

Read-only. Trades come from the latest ~300 trades of each token Kadd lists (Monad mainnet), so the window is
hours, not days — always state the window (`windowHours`) when you quote numbers.

## Setup

`KADD_API` = the Kadd deployment's base URL (no trailing slash). Ask once if unset; local dev is
`http://localhost:3123`.

Shell state may not persist between your commands, so put the base inline when needed:
`KADD_API=http://localhost:3123; curl -s "$KADD_API/..."`. `GET $KADD_API/api/agent/help` lists every endpoint.

## Command

```bash
curl -s "$KADD_API/api/agent/wallet/<address>"
```

## Response (key fields)

- `nadName`: the wallet's `.nad` name, if it has one. Use it as the display name.
- `nansenSmartMoney`: `{ label, pnl30dUsd, realizedUsd, winRatePct, trades }` when Nansen labels this wallet as smart
  money on Monad, else `null`. This is its real 30-day PnL across all its Monad trades — lead with it when present,
  ahead of the window-limited activity and backtest.
- `windowHours`, and a `note` on how the window is built. `path` = the wallet page (append to `KADD_API`).
- `activity`: `volumeUsd`, `trades`, `buys`, `sells`, `netFlowUsd` (USD sold − bought; positive = took money out),
  `medianBuyUsd`, `tokens` (symbols). `null` = no trades in the window.
- `copyBacktest`: `pnlUsd`, `roiPct`, `investedUsd` ($10 × copied buys), `tradesCopied` (copied buys **and** sells),
  `closedPositions`, `winRatePct` (over closed positions only; `null` if none closed), and the `rule` it used. At the
  wallet's own prices, before fees and slippage.
- `holdings[]`: `symbol`, `token`, `amount`, `usd` — only tokens Kadd lists. `monBalance`.
- `kaddTestnet30d`: `pnlUsd`, `roiPct`, `trades`, `volumeUsd`, `winRatePct`, or `null` if it never traded on Kadd.
- `recentTrades[]`: `at` (ISO, UTC), `side`, `symbol`, `token`, `usd`, `priceUsd`, `tx`.

## How to answer

1. Who: `nadName` or short address, the window, and a one-line style read from the numbers (e.g. "22 buys / 6 sells
   across 4 tokens in 24 h — an accumulator, mostly small buys").
2. Copy backtest: ROI and PnL with the rule in plain words, the number of copied trades, win rate. Then sanity-check
   it, and say so plainly when any of these hold:
   - fewer than 5 copied trades, or fewer than 3 closed positions → too small a sample (a 100% win rate from one
     closed position means nothing);
   - `medianBuyUsd` far below $10 (e.g. dust buys of a few cents) → the $10-per-buy backtest weights trades the
     wallet itself barely committed to; its real conviction is in its few large buys;
   - all trades in one token → it's one bet, not a track record.
3. Holdings: if it bought a lot but holds none, mention that bots often trade from one address and receive at
   another — it doesn't mean it sold.
4. If the user wants to act: one-tap copy happens in the Kadd app; automated copying on testnet is kadd-trade
   (auto copy).

Don't infer identity or link the address to a person. Not financial advice.
