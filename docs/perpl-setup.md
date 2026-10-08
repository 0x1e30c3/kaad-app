# Perpl in Kadd: setup

Kadd uses [Perpl](https://app.perpl.xyz) (perpetual futures on Monad) in two ways:

1. **Perps leaderboard** (Leaderboard → Perps · Perpl, and a "Perps on Perpl" panel on wallet pages): every open
   position on Perpl mainnet, read straight from the Exchange contract (`getPositionsV2`), plus 30-day realized PnL
   per trader from Kadd's Envio indexer (`PerplExchange` on chain 143). Nothing to set up except redeploying the
   indexer (step 5).
2. **Kadd copy bot**: one Perpl testnet account that mirrors a chosen mainnet trader every keeper tick, with a fixed
   budget and a leverage cap. Setup below.

## How the bot works

Every keeper tick (`/api/copy/keeper`, at most every 30 s) the bot:

1. reads the leader's open positions on mainnet and the leader's equity (margin in positions + free balance),
2. reads its own positions on testnet (Perpl API, trade-only key),
3. computes the target book: the leader's positions scaled by `budget / leader equity`, leverage capped at
   `PERPL_BOT_MAX_LEVERAGE`, total margin never above the budget,
4. sends market IOC orders for the difference (closes first when the leader flipped or exited). Differences under
   $10 or 20% of the target are left alone so it doesn't churn.

It reconciles positions, not fills, so a missed tick just catches up on the next one. Logic and checks:
[`perplBot.ts`](../kadd/src/lib/perplBot.ts), [`perplBot.check.ts`](../kadd/src/lib/perplBot.check.ts).

## Setup (testnet)

1. **A dedicated bot wallet.** Create a fresh wallet that holds nothing else (testnet only). Get a little testnet MON
   for gas.
2. **Open a Perpl testnet account.** Connect that wallet at https://testnet.perpl.xyz and deposit testnet AUSD (at
   least 100 AUSD opens an account). If the testnet app has no faucet, ask in Perpl's Discord.
3. **Enable One-Click Trading** for the account in the testnet app (order forwarding). Without it Perpl refuses
   API orders, and the bot reports exactly that.
4. **Create an API key** at https://testnet.perpl.xyz/apikeys with the **trade** scope. You get the `X-API-Key`
   token and the private key. Treat both as secrets.
5. **Vercel → Environment Variables**, then redeploy:

   | Name | Value |
   |------|-------|
   | `PERPL_BOT_API_KEY` | the `X-API-Key` token |
   | `PERPL_BOT_API_SECRET` | the API key's private key (hex) |
   | `PERPL_BOT_ADDRESS` | the bot wallet address (for the public card) |
   | `PERPL_BOT_LEADER` | the mainnet trader to mirror: pick one on Leaderboard → Perps · Perpl |
   | `PERPL_BOT_BUDGET_USD` | AUSD the bot may commit as margin (default 200) |
   | `PERPL_BOT_MAX_LEVERAGE` | leverage cap (default 3) |
   | `PERPL_BOT_PAUSED` | `1` stops new orders immediately |

6. **Check it.** `https://kaad-app.vercel.app/api/copy/keeper` now has a `perpl` field:
   - `{"ran": true, "orders": [...]}`: each order with Perpl's status code (0 = accepted for forwarding),
   - `{"ran": false, "reason": "..."}`: what's missing (not configured, One-Click Trading off, no account yet),
   - `{"error": "..."}`: Perpl refused the request (wrong key, clock skew, …).

   The leaderboard's Perps tab shows the bot's book next to the leader's.

## Indexer (realized PnL)

The Kadd indexer now also indexes Perpl on Monad mainnet (`PerplTrader`, `PerplTraderDay`). After this change reaches
`dev`, Envio Cloud builds a **new deployment with a new GraphQL URL**: once it has synced, put that URL in
`ENVIO_INDEXER_URL` on Vercel and redeploy. Until then the Perps tab ranks by open PnL and says the history is syncing.

## Questions for Perpl (Discord)

- Does testnet activity count as "real onchain activity" for the API bounty, or does it need mainnet?
- A **builder code** for Kadd (fee on orders Kadd routes: the revenue path).
- **Origin whitelisting** for `kaad-app.vercel.app`, so users can delegate a trade-only key to Kadd with their passkey
  (copy perps from their own account) instead of only the shared bot.
