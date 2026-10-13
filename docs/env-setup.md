# Environment variables

Every variable the Kadd app (`kadd/`), the indexer (`indexer/`) and the contract scripts (`contracts/`) read, what it
does, and where its value comes from. Nothing here is a secret: values that are secrets are marked **secret** and live
only in `kadd/.env.local` (gitignored) and in Vercel → Project → Settings → Environment Variables.

`kadd/.env.example` is the copy-paste template. Locally: `cp kadd/.env.example kadd/.env.local`, then fill in what you
need. Most variables either have a working default or switch their feature off when empty; the table below says
which ones a real deploy needs.

Legend: **Public** = `NEXT_PUBLIC_*`, baked into the browser bundle at build time (changing it needs a redeploy).
**Server** = read only on the server. **Secret** = never commit, never paste in chat; rotate if it leaks.

## Minimum for a working deploy

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | correct links in share cards, OG images and Telegram messages |
| `DRIP_PRIVATE_KEY` | new passkey accounts get testnet MON for gas; without it nobody can transact |
| `ENVIO_INDEXER_URL` | Stats, Kadd leaderboard and Perpl all-time PnL / liquidations |
| `NANSEN_API_KEY` | smart-money wallets (leaderboard, home, ticker) |
| `COINGECKO_API_KEY` | market data that doesn't get rate-limited on Vercel's shared IPs |

Everything else adds a feature (Telegram, Perpl copy bot, Kuru referral) or overrides a default.

---

## 1. Site & network

| Variable | Type | Default | What it does |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public | `https://<VERCEL_PROJECT_PRODUCTION_URL>`, else `http://localhost:3000` | Absolute base URL for metadata, OG images, invite links and Telegram messages. Set to `https://kaad-app.vercel.app` in production. |
| `NEXT_PUBLIC_RPC_URL` | Public | viem's Monad testnet RPC | Monad **testnet** RPC for the browser and server (swaps, balances, status bar). Use a private endpoint if the public one rate-limits. |
| `MAINNET_RPC_URL` | Server | viem's Monad mainnet RPC | Monad **mainnet** RPC used to read Perpl (positions, markets, liquidation map). |
| `VERCEL_PROJECT_PRODUCTION_URL` | Server | set by Vercel | Fallback for `NEXT_PUBLIC_SITE_URL`. Don't set it yourself. |

## 2. Kadd contracts on Monad testnet (all Public)

All have the current deployment as a built-in default, so leave them empty unless you redeploy a contract.
Addresses are in `contracts/deployment.json`.

| Variable | Contract | Deploy script |
|---|---|---|
| `NEXT_PUBLIC_VENUE` | KaddVenue: testnet pools, swaps | `DeployVenue.s.sol` |
| `NEXT_PUBLIC_TUSDC` | tUSDC: test USDC + faucet | `DeployVenue.s.sol` |
| `NEXT_PUBLIC_CLUB_FACTORY` | onchain clubs | `DeployVenue.s.sol` |
| `NEXT_PUBLIC_STRATEGIES` | limit / TP / SL / DCA orders | `DeployStrategies.s.sol` |
| `NEXT_PUBLIC_COPY` | auto copy vaults (KaddCopy) | `DeployCopy.s.sol` |
| `NEXT_PUBLIC_COPY_CLUBS` | copy clubs | `DeployCopyClubs.s.sol` |
| `NEXT_PUBLIC_REFERRALS` | invite attribution (KaddReferrals) | `DeployReferrals.s.sol` |
| `NEXT_PUBLIC_COPY_MAINNET` | KaddCopyKuru on mainnet. **Not deployed** (team decision): leave empty, the UI shows "coming soon". | — |

## 3. Server wallets (testnet only)

Use dedicated wallets made with `cast wallet new`, funded with **testnet** MON only. They never hold user funds.

| Variable | Type | Default | What it does |
|---|---|---|---|
| `DRIP_PRIVATE_KEY` | Server, **secret** | — | Sends each new passkey account a little testnet MON for gas (`/api/drip`). Without it, new users can't transact. |
| `DRIP_AMOUNT_MON` | Server | `0.25` | MON per drip. |
| `KEEPER_PRIVATE_KEY` | Server, **secret** | falls back to `DRIP_PRIVATE_KEY` | Signs `copyBuy` / `copySell` for auto copy vaults and copy clubs. Must be the `KEEPER` address given at deploy (see §8). |

## 4. Data providers

| Variable | Type | Where to get it | What it does |
|---|---|---|---|
| `COINGECKO_API_KEY` | Server, **secret** | [coingecko.com/en/api](https://www.coingecko.com/en/api) (free Demo plan) | Market data through CoinGecko's onchain API with a per-key limit instead of GeckoTerminal's per-IP one. Without it, prices/charts can fail on busy cloud IPs. |
| `NANSEN_API_KEY` | Server, **secret** | Nansen API dashboard | Smart-money wallets on Monad with 30-day PnL (leaderboard, home "Smart money", ticker, wallet labels). Without it those parts hide or fall back. |
| `ENVIO_INDEXER_URL` | Server | Envio Cloud → your deployment → GraphQL URL, e.g. `https://indexer.dev.hyperindex.xyz/<id>/v1/graphql` | Kadd's HyperIndex indexer: Stats, Kadd leaderboard, Perpl all-time PnL, flows and liquidations. **Changes on every push to `dev`** (new deployment): update it and redeploy. |
| `ENVIO_API_TOKEN` | Server, **secret** | [envio.dev/app/api-tokens](https://envio.dev/app/api-tokens) | HyperRPC fallback for Stats and event scans when `ENVIO_INDEXER_URL` isn't set. |

## 5. Telegram alerts

Full walkthrough: [`telegram-setup.md`](telegram-setup.md).

| Variable | Type | What it does |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Server, **secret** | Bot token from @BotFather. |
| `NEXT_PUBLIC_TELEGRAM_BOT` | Public | Bot username without `@`, used for the `t.me/<bot>` button. |
| `TELEGRAM_WEBHOOK_SECRET` | Server, **secret** | Random string; Telegram sends it back so `/api/telegram/webhook` can reject forged calls. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Server, **secret** | Redis (Upstash via the Vercel Marketplace) for Telegram subscriptions **and private notes** (encrypted vaults; without it the notes panel says storage isn't set up). Vercel sets these when you connect the store. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are accepted as aliases. |

## 6. Perpl copy bot (testnet)

Full walkthrough: [`perpl-setup.md`](perpl-setup.md). Mirrors one Perpl mainnet trader on Perpl testnet.

| Variable | Type | Default | What it does |
|---|---|---|---|
| `PERPL_BOT_API_KEY` | Server, **secret** | — | Perpl testnet API key (trade scope; Perpl keys can't withdraw), from testnet.perpl.xyz/apikeys. |
| `PERPL_BOT_API_SECRET` | Server, **secret** | — | Its secret. |
| `PERPL_BOT_ADDRESS` | Server | — | The bot wallet's address (shown on the leaderboard). |
| `PERPL_BOT_LEADER` | Server | — | The mainnet trader to mirror. |
| `PERPL_BOT_BUDGET_USD` | Server | `200` | Total AUSD the bot may use. |
| `PERPL_BOT_MAX_LEVERAGE` | Server | `3` | Leverage cap per position. |
| `PERPL_BOT_PAUSED` | Server | empty | `1` stops the bot without removing its keys. |

## 7. Kuru referral (mainnet spot, optional)

| Variable | Type | Default | What it does |
|---|---|---|---|
| `KURU_REFERRER` | Server | — | Address that receives Kuru Flow referral fees on mainnet swaps made in Kadd. Ignored unless it's a valid address. |
| `KURU_REFERRER_BPS` | Server | `0` | Referral fee in basis points (100 = 1%). |

## 8. Contract deploy scripts (`contracts/`, Foundry)

Read by `forge script` only, not by the app. The deployer key is never an env var: the scripts sign with a Foundry
keystore account (`--account <name>`), which asks for its password.

| Variable | Used by | Default | Meaning |
|---|---|---|---|
| `VENUE` | `DeployCopy`, `DeployCopyClubs`, `DeployStrategies` (default: current venue); `SeedMirrors` (required) | current KaddVenue | The venue the new contract trades through. |
| `KEEPER` | `DeployCopy`, `DeployCopyClubs` (required) | — | Address allowed to copy trades; must match `KEEPER_PRIVATE_KEY` in the app. |
| `ACCOUNT_CORE` | `Deploy.s.sol` | `0xdbaaDe7B…8038` | Monad testnet account core used by the venue deploy. |
| `USDC` | `Deploy.s.sol` | `0xA402B424…fEF1` | USDC on Monad testnet. |

## 9. Indexer (`indexer/`)

| Variable | When | Meaning |
|---|---|---|
| `ENVIO_RPC_URL` | only with `ENVIO_CONFIG=config.rpc.yaml` | Plain RPC to index through instead of HyperSync (local tests). |
| `ENVIO_CONFIG` | local tests | Which config file Envio loads. |

Envio Cloud needs no variables: it builds `indexer/config.yaml` from the repo. After a deploy, copy the new GraphQL URL
into the app's `ENVIO_INDEXER_URL`.

## 10. Set automatically — don't set these

`NEXT_PHASE` (Next.js build phase), `VERCEL_PROJECT_PRODUCTION_URL` (Vercel). `ERRS` and `EXABI` are only read by the
local debugging script `kadd/scripts/perpl-fork.mts`.

---

## Checklist: Vercel

1. Vercel → Project → Settings → Environment Variables. Add the variables you need for **Production** (and Preview if
   you test there). Mark every **secret** as *Sensitive*.
2. `NEXT_PUBLIC_*` values are baked in at build: after changing one, **redeploy**.
3. After every merge to `dev` that touches `indexer/`, Envio creates a new deployment: update `ENVIO_INDEXER_URL`
   and redeploy. Charts on `/perps/risk` can take 1–2 minutes to fill after a redeploy.
4. If a secret was ever printed in a log, a chat or a commit, rotate it at its provider and update it here.
