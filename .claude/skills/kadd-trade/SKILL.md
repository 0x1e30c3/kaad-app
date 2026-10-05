---
name: kadd-trade
description: Paper-trades Monad memecoins on Kadd's testnet venue and sets up automated copy trading of a real Monad wallet — buy with test USDC, sell a % of a position, open a token's testnet pool at its mainnet price, start / list / stop auto copy vaults — by fetching a ready `cast` plan from the Kadd agent API and running it with the agent's own testnet key. Use when the user wants to "buy X on Kadd", "paper trade", "practice trade", "test this strategy", "copy this wallet automatically", "beli token ini di testnet", "coba trading pakai uang test", "auto copy wallet ini", "stop copy". Testnet only, no real funds move.
argument-hint: "buy <token> <tUSDC> | sell <token> <percent> | copy <wallet> [perTrade dailyCap deposit] | copies | stop <id>"
---

# Testnet trading and auto copy

Everything here runs on **Monad testnet** with free test USDC (tUSDC). Prices start from the token's real mainnet
price; nothing touches mainnet funds. The API never sees a private key: it returns `cast` commands, and you run them
locally with the user's testnet key.

## Setup

- `KADD_API` = the Kadd deployment's base URL (no trailing slash). Ask once if unset.
- `KADD_PRIVATE_KEY` = a **testnet-only** key in the environment. Never ask the user to paste a key into chat, never
  print it, never write it to a file. If it's missing, tell the user to export it in their shell. If they don't have
  one: `cast wallet new`, then gas from https://faucet.monad.xyz.
- Foundry's `cast` must be installed (`curl -L https://foundry.paradigm.xyz | bash && foundryup`).
- The user's address: `cast wallet address --private-key $KADD_PRIVATE_KEY`.
- Commands use bash/zsh syntax (`$(...)`); in fish, run them through `bash -c`.

Shell state may not persist between your commands, so put the base inline when needed:
`KADD_API=http://localhost:3123; curl -s "$KADD_API/..."`. `GET $KADD_API/api/agent/help` lists every endpoint.

## Trade

```bash
curl -s "$KADD_API/api/agent/trade?token=<mainnet_token>&side=buy&amount=<tUSDC>&from=<address>"
curl -s "$KADD_API/api/agent/trade?token=<mainnet_token>&side=sell&amount=<percent 1-100>&from=<address>"
# optional: &slippageBps=100 (default 1%)
```

`token` is the **mainnet** token address (from kadd-market / kadd-token; look a ticker up with
`/api/agent/search?q=`), not the testnet mirror. If the token wasn't checked in this conversation, offer kadd-token
first — one line, not a blocker.

The response has `status` and `steps[]` (`why`, `cmd`):

- `status: "needs-pool"` → one step opens the token's testnet pool at its mainnet price. Run it, then request the
  plan again.
- `status: "ready"` → also `pool`, `testnetPriceUsd`, `amountIn`, `expectedOut`, `minOut`, `note`. Atoms: tUSDC has 6
  decimals, tokens 18 — so a buy's `amountIn` is tUSDC atoms and its `expectedOut`/`minOut` token atoms; a sell is
  the reverse. The API already checked the `from` wallet: a `faucet()` step (1,000 free tUSDC, once an hour) appears
  only if its tUSDC is short, and `approve` only if the allowance is short. The last step is `swapExact`, which sends
  the output to `from`; its deadline is 5 minutes after the moment you run it.
- Testnet pools open at the mainnet price but aren't kept in sync, so `testnetPriceUsd` can drift from mainnet —
  mention the gap if it's over ~5%.

**Before running anything, show the user the plan — each `why` and the amounts — and get a yes.** If the user only
asked for a plan (or there's no `KADD_PRIVATE_KEY`), show it and stop there. Then run the
`cmd`s in order, each one only after the previous succeeded (`status 1 (success)`). On `Slippage`, fetch a fresh plan
once; on `TooSoon` (faucet cooldown), tell the user when it refills instead of retrying.

## Auto copy

A vault the user funds with tUSDC; Kadd's keeper copies every **new** trade the leader makes on a token Kadd lists,
within a few minutes. The contract enforces: only Kadd pools, at most `perTrade` per buy, at most `dailyCap` per
UTC day, each leader trade once, and the owner can stop anytime and get tUSDC + tokens back. The keeper only decides
*when* to copy.

```bash
# plan to start: defaults perTrade=10, dailyCap=50, deposit=100, sells=true
curl -s "$KADD_API/api/agent/copy?leader=<wallet>&from=<address>&perTrade=10&dailyCap=50&deposit=100&sells=true"
# the user's vaults (each active one has a ready stopCmd)
curl -s "$KADD_API/api/agent/copy?owner=<address>"
```

Before starting, suggest checking the leader with kadd-wallet (copy backtest). Confirm the numbers with the user,
then run the steps like a trade plan. To stop, confirm, then run that vault's `stopCmd`.

## Never

- Run a step without the user's go-ahead, or chain new trades the user didn't ask for.
- Use a mainnet key or send anything on mainnet. The plans target `https://testnet-rpc.monad.xyz` only.
- Present testnet results as real profit.
