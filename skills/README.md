# Kadd skills

Agent skills that let any AI agent research Monad memecoins, profile and rank real wallets, and paper-trade or
auto-copy them on Kadd's testnet venue. They call the Kadd agent API (`/api/agent/*`), which is public and
read-only; trading returns `cast` plans that the agent signs locally with its own testnet key.

| Skill | What it does |
|-------|--------------|
| `kadd-market` | Trending, hot (1h activity), 1h gainers, new, and top-volume Monad tokens |
| `kadd-token` | Find a token by ticker; due diligence: market data, checks, 0–100 risk score with reasons, recent trades |
| `kadd-wallet` | A wallet's recent trades, holdings, `.nad` name, Kadd PnL, and a copy-trading backtest |
| `kadd-smart-money` | Nansen smart money with real 30-day PnL; wallets trading Monad now by volume, activity, net flow or Copy ROI; Kadd PnL board |
| `kadd-trade` | Testnet buys and sells at mainnet prices, and auto copy vaults (start, list, stop) |

## Install

```bash
npx skills add maulana-tech/kaad-app   # the GitHub repo is named kaad-app
```

Then set the API base and, for trading only, a testnet key:

```bash
export KADD_API=https://<your-kadd-deployment>     # http://localhost:3123 for local dev
export KADD_PRIVATE_KEY=0x...                       # testnet-only key, needed by kadd-trade
```

## Try

- "What's hot on Monad in the last hour?"
- "Check this token: 0x350035555e10d9afaf1566aaebfced5ba6c27777"
- "Which wallets are worth copying right now?"
- "Should I copy 0xb42f812a44c22cc6b861478900401ee759ebead6?"
- "Buy 10 tUSDC of CHOG on Kadd" / "Auto-copy that wallet with $5 per buy"

## API

`GET $KADD_API/api/agent/help` lists every endpoint. Responses are JSON; errors are `{ "error": "..." }` with 400 for
bad input and 502 when upstream market data is briefly unavailable.
