---
name: kadd-market
description: Lists Monad memecoins live — trending (24h), hot (1h activity), biggest 1h gainers, brand-new pairs, or top 24h volume — with price, market cap, liquidity, % change, buy/sell counts, age and a coarse risk badge, via the Kadd agent API. Use when the user asks what's moving on Monad, e.g. "what's trending on Monad", "new tokens on Monad", "hot memecoins right now", "top volume Monad", "token apa yang lagi naik di Monad", "koin baru di Monad". To find a token by ticker or name, and for one specific token, use kadd-token instead.
argument-hint: "[trending|hot|gainers|new|volume] [limit]"
---

# Monad market lists

Data comes from the Kadd agent API, which reads live Monad mainnet pools (GeckoTerminal) and caches them for about
a minute. It is read-only and needs no key.

## Setup

`KADD_API` is the Kadd deployment's base URL, e.g. `https://kadd.example.app` (no trailing slash). If it isn't set,
ask the user for it once; for a local dev server it's `http://localhost:3123`.

Shell state may not persist between your commands, so put the base inline when needed:
`KADD_API=http://localhost:3123; curl -s "$KADD_API/..."`. `GET $KADD_API/api/agent/help` lists every endpoint.

## Command

```bash
curl -s "$KADD_API/api/agent/market?list=<list>&limit=<n>"
```

| Param | Values | Default |
|-------|--------|---------|
| `list` | `trending` (24h trending), `hot` (most active in the last hour — activity, not price gain), `gainers` (biggest 1h % move among trending + hot), `new` (newest pairs), `volume` (top 24h volume) | `trending` |
| `limit` | 1–50 | 20 |

Pick the list from the user's words: "new / baru / just launched" → `new`; "pumping / naik / gainers" → `gainers`;
"active / ramai / right now" → `hot`; "most traded / volume" → `volume`; otherwise `trending`.

## Response

`{ chain, list, count, tokens[] }`. Each token: `address`, `symbol`, `name`, `priceUsd`, `marketCapUsd`,
`liquidityUsd`, `change.{h1,h6,h24}` (%), `volume24hUsd` and `txns24h.{buys,sells,buyers?,sellers?}` (for the token's
main pool only, so they can look small next to market cap), `ageHours`, `risk` (`safe` | `caution` | `danger`, from
liquidity and pool age only), `pool`, `dex`, `path` (append to `KADD_API` for the token page).

## How to answer

1. Show a compact table: symbol, price, 1h %, 24h %, market cap, liquidity, age, risk. Keep the API's order.
2. Call out at most three things worth noticing, each backed by a number. If nothing stands out (flat or red
   across the board), say exactly that in one line rather than dressing it up. Worth noticing: a strong 1h move, buys far outnumbering
   sells, a token younger than 24h, liquidity under $10k.
3. `risk` here is a quick badge, not due diligence. Before anyone acts on a token, run kadd-token on it.
4. Never present this as financial advice. Memecoins are extremely risky; say so once, briefly.

## Errors

- `400` → the message says which parameter is wrong; fix it and retry once.
- `502` → upstream data is briefly unavailable; wait ~30 s and retry once, then tell the user.
