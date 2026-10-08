# Perpl in Kadd: setup

Kadd uses [Perpl](https://app.perpl.xyz) (perpetual futures on Monad) in three ways:

0. **Perps from your passkey** (`/perps`): open a Perpl account with AUSD, go long or short, close, withdraw, all
   signed by the Kadd passkey account straight on the Exchange contract (`createAccount`, `execOrder`). No API key,
   no whitelist (Perpl's `whitelistingEnabled()` is false). Testnet for practice, mainnet with real AUSD (Get AUSD
   swaps MON → AUSD on Kuru). Nothing to set up. Optional: put testnet AUSD in the gas-drip wallet and new accounts
   get 150 AUSD with their gas, so the testnet flow never leaves Kadd. Fork-tested:
   [`scripts/perpl-fork.mts`](../kadd/scripts/perpl-fork.mts).

1. **Perps leaderboard** (Leaderboard → Perps · Perpl, and a "Perps on Perpl" panel on wallet pages): every open
   position on Perpl mainnet, read straight from the Exchange contract (`getPositionsV2`), plus all-time PnL (live equity minus net deposits)
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

What ends up on Vercel is only the bot's **address** and a **trade-only API key**. The bot wallet's private key never
goes to Vercel, the repo or anyone else: Kadd doesn't need it, and a Perpl API key can't withdraw.

### 1. Create a dedicated bot wallet

Use a fresh account that will only ever hold testnet funds.

**Option A: MetaMask or Rabby (simplest)**

1. Open the extension → account menu → **Add account** / **Create account**. Name it e.g. `Kadd Perpl Bot`.
2. Copy its address: this is `PERPL_BOT_ADDRESS`.

**Option B: terminal (Foundry)**

```sh
~/.foundry/bin/cast wallet new
```

It prints a new address and private key. Import the private key into MetaMask / Rabby (**Import account**) so you can
use it on testnet.perpl.xyz, then clear your terminal history. Don't save the key in the repo or in `.env` files.

### 2. Gas: testnet MON

1. Add **Monad Testnet** to the wallet if it isn't there (testnet.perpl.xyz usually offers to add it on connect):

   | Field | Value |
   |-------|-------|
   | Network name | Monad Testnet |
   | RPC URL | `https://testnet-rpc.monad.xyz` |
   | Chain ID | `10143` |
   | Currency | `MON` |
   | Explorer | `https://testnet.monadexplorer.com` |

2. Get testnet MON at https://faucet.monad.xyz for the bot address. About 0.5 MON covers the account setup
   transactions.

### 3. Open a Perpl testnet account

1. Open https://testnet.perpl.xyz and connect **the bot account** (check the address in the top bar).
2. Get testnet **AUSD**, Perpl's collateral. Look for a faucet / "get test funds" button in the testnet app. If there
   isn't one, ask in Perpl's Discord for testnet AUSD for your bot address.
3. **Deposit** at least **100 AUSD**: the first deposit creates the exchange account (Perpl's minimum to open one).
   Deposit at least `PERPL_BOT_BUDGET_USD` (default 200) so the bot can use its whole budget.

### 4. Enable One-Click Trading

In the testnet app, turn on **One-Click Trading** for the account (on-chain "order forwarding", one transaction).
Without it Perpl refuses API orders, and the bot's status says so.

### 5. Create the API key

1. Open https://testnet.perpl.xyz/apikeys with the bot account connected.
2. Create a key with the **trade** scope, label `kadd-bot`, no expiry (or a long one).
3. The app shows two values once:
   - the **`X-API-Key` token**: `PERPL_BOT_API_KEY`,
   - the **private key** (hex): `PERPL_BOT_API_SECRET`.

   Paste them straight into Vercel (next step). Don't send them in chat or commit them.

### 6. Pick the leader

Open https://kaad-app.vercel.app/leaderboard → **Perps · Perpl** and pick a mainnet trader to mirror. A good first
pick holds positions in markets that also exist on testnet (BTC, ETH, SOL, MON, ZEC, LIT, PUMP, NEAR) at moderate
leverage. Copy its address: `PERPL_BOT_LEADER`.

### 7. Vercel environment variables

Vercel → `kaad-app` → Settings → Environment Variables (Production), then **redeploy**:

| Name | Value |
|------|-------|
| `PERPL_BOT_API_KEY` | the `X-API-Key` token |
| `PERPL_BOT_API_SECRET` | the API key's private key (hex) |
| `PERPL_BOT_ADDRESS` | the bot wallet address (shown on the public card) |
| `PERPL_BOT_LEADER` | the mainnet trader to mirror |
| `PERPL_BOT_BUDGET_USD` | AUSD the bot may commit as margin (default 200) |
| `PERPL_BOT_MAX_LEVERAGE` | leverage cap (default 3) |
| `PERPL_BOT_PAUSED` | `1` stops new orders immediately; empty to run |

### 8. Check it

The bot runs on the keeper tick, so the cron pinger on `/api/copy/keeper` must be on. Open
`https://kaad-app.vercel.app/api/copy/keeper` and look at the `perpl` field:

| You see | Meaning |
|---------|---------|
| `{"ran": true, "orders": []}` | Running, already matching the leader (or the leader is flat) |
| `{"ran": true, "orders": [{ "code": 0, ... }]}` | Orders accepted for forwarding; fills show on testnet.perpl.xyz a block later |
| `{"ran": false, "reason": "not configured"}` | One of `PERPL_BOT_API_KEY`, `PERPL_BOT_API_SECRET`, `PERPL_BOT_LEADER` is missing |
| `{"ran": false, "reason": "enable One-Click Trading…"}` | Step 4 isn't done |
| `{"ran": false, "reason": "ran recently"}` | Normal: it runs at most every 30 s per server instance |
| `{"error": "…no Perpl testnet account yet…"}` | Step 3: no deposit yet |
| `{"error": "perpl GET …: 401 …"}` | Wrong key or secret, or the key was revoked |
| An order with `code` 400 | Perpl refused that order (the `error` says why: size too small, market closed, …) |

The leaderboard's **Perps · Perpl** tab then shows a **Kadd copy bot** card: the leader's book on mainnet next to the
bot's book on testnet. Every order is a real testnet transaction, visible on the explorer from the bot address.

### Stopping or changing it

- **Pause**: set `PERPL_BOT_PAUSED=1` and redeploy. Open positions stay; close them on testnet.perpl.xyz if you want.
- **Change leader or budget**: edit the variables and redeploy. On the next tick the bot reconciles to the new
  leader (closing what the new leader doesn't hold).
- **Revoke**: delete the key at testnet.perpl.xyz/apikeys. The bot stops at once; funds stay in the account.

## Indexer (deposits, withdrawals, liquidations)

The Kadd indexer also indexes Perpl on Monad mainnet, but only its low-volume events (`PerplMarket`, `PerplAccount`,
`PerplLiquidation`, `PerplDaily`): about 36k events for the whole history, inside Envio Cloud's free plan (100k).
Indexing closes and fills too (~50k a day, 70M+ in total) exceeds that plan, so Kadd derives PnL as equity minus net
deposits instead. Each indexer change gives a new Envio deployment URL: once it has synced, put it in
`ENVIO_INDEXER_URL` on Vercel and redeploy. Without it the Perps tab ranks by open PnL.

## Questions for Perpl (Discord)

- Does testnet activity count as "real onchain activity" for the API bounty, or does it need mainnet?
- A **builder code** for Kadd (fee on orders Kadd routes: the revenue path).
- **Origin whitelisting** for `kaad-app.vercel.app`, so users can delegate a trade-only key to Kadd with their passkey
  (copy perps from their own account) instead of only the shared bot.
