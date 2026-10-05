---
name: kadd-token
description: Finds a Monad token by ticker or name, and runs due diligence on one by contract address — price, market cap, liquidity, holders, honeypot / trust checks, a 0–100 rule-based risk score with the exact reasons behind every point, plain-language advice, and the latest trades with wallet addresses — via the Kadd agent API. Use when the user gives a Monad token address (CA) or asks "is this token safe", "rug check", "analyze this token", "cek token ini", "aman nggak token ini", "risk token". For lists of tokens use kadd-market; for a wallet address use kadd-wallet.
argument-hint: "<token_address>"
---

# Token due diligence

Read-only. Data is live Monad mainnet (GeckoTerminal + DexScreener); the risk score is deterministic rules, not an
LLM, so every point has a stated cause.

## Setup

`KADD_API` = the Kadd deployment's base URL (no trailing slash). Ask once if unset; local dev is
`http://localhost:3123`.

Shell state may not persist between your commands, so put the base inline when needed:
`KADD_API=http://localhost:3123; curl -s "$KADD_API/..."`. `GET $KADD_API/api/agent/help` lists every endpoint.

## Step 0 — is it a token?

The input must be a `0x` + 40 hex address (any letter case). If the user gave a ticker or name, look it up first:

```bash
curl -s "$KADD_API/api/agent/search?q=<ticker or name>&limit=5"
```

Results come most-liquid first. If several tokens share the ticker, show the top ones (symbol, name, liquidity,
address) and ask which one; tickers are not unique and copycats are common.

If the token endpoint returns 404, the address isn't a token with a Monad pool — it may be a wallet; offer
kadd-wallet.

## Command

```bash
curl -s "$KADD_API/api/agent/token/<address>"
```

## Response (key fields)

- Market: `priceUsd`, `marketCapUsd`, `liquidityUsd`, `change`, `volume24hUsd`, `txns24h`, `ageHours`, `holders`.
- `checks[]`: `{label, value, ok}` — `ok: null` means no data, not "fine".
- `analysis`: `riskScore` (0 safest → 100 most dangerous), `level` (`low` | `medium` | `high` | `critical`),
  `summary`, `factors[]` (`severity`, `points`, `title`, `detail`), `advice[]`.
- `recentTrades[]`: `side`, `usd`, `ageSec`, `wallet`, `tx`. Wallets here can be profiled with kadd-wallet.
- `kadd.testnetPool`: the token's Kadd testnet mirror pool, or `null` if nobody opened one yet (kadd-trade can).

## How to answer

1. One line verdict: level + score, e.g. "High risk (68/100)".
2. The factors that drive the score, highest points first, each with its number. Then the `good` factors briefly.
3. Market snapshot in one short table.
4. If `recentTrades` shows one wallet dominating volume, name it and suggest kadd-wallet on it.
5. End with the API's `advice`, and that this is not financial advice.

Never round a `critical` level down in wording. Never claim a token is "safe" — the best the data supports is
"no red flags found in these checks".
