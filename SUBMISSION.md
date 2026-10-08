# Kadd — Metropolis submission kit

Primary track: **Onchain Finance & Trading**. Live: https://kaad-app.vercel.app

> **To fill in before submitting** (marked ✍️ below): first user, traction numbers, team, and the repo access for
> `metropolis@hackathon.monad.xyz` (the repo is private: make it public or invite that address).

## One line

Kadd turns Monad's smart money into something you can safely follow: see who's winning, backtest copying them,
practise at real prices, then auto-copy with limits a contract enforces — alone or as a club — and go live on mainnet
through Kuru.

## Judging criteria → evidence

| Criterion | Evidence |
|-----------|----------|
| **Technical (20%)** — trading works end to end onchain | Swaps, clubs, strategies and copy vaults are real testnet transactions on Kadd's contracts (all Sourcify verified, [`contracts/deployment.json`](contracts/deployment.json)). First live copy of a mainnet wallet: [`0xea13…abea`](https://testnet.monadexplorer.com/tx/0xea138255e9d549667e6b758a6f57135717f3be0e559ceb5d873fdcf3bc91abea). Live mainnet swaps through Kuru Flow from the same passkey account. `KaddCopyKuru` (mainnet auto copy, not deployed) copies a real Kuru Flow route on a mainnet fork. 96 Foundry tests plus fork tests against real Kuru (Spot V2 and Flow), an indexer test on real chain history, self-checks for the data logic. |
| **Design (20%)** — pricing and risk clear to traders | `/start`: landing to a confirmed first trade in about a minute, with a timer. Every trade shows expected output and guaranteed minimum; a 0–100 risk score with the reason for every point; copy limits stated where you set them; testnet vs mainnet always labelled. |
| **Originality (15%)** — new market structure | Non-custodial copy vaults whose limits are enforced onchain (the keeper only decides *when*), clubs: pooled funds where the captain trades within a contract cap and anyone exits at will, and copy clubs that combine the two (friends pool into one vault that auto-copies a wallet; deposits only while flat, exit in kind anytime). Both need sub-second settlement to feel like trading. |
| **Founder & market (25%)** | ✍️ First user: *e.g. members of [community] who today copy KOL calls by hand — screenshot, then buy, late and without limits.* |
| **Traction (20%)** | ✍️ Stats page (live from the contracts): trades, volume, wallets, clubs, copy vaults. "N copying" on every wallet, share cards (wallet and vault images for X / Telegram) and notifications for followed wallets and copies drive the loop. Invites are attributed **onchain** (`KaddReferrals`): Stats shows how many wallets joined through an invite and how many of them traded, so the growth number is checkable. A public "Best auto copy" leaderboard ranks every vault and copy club by return. Next: mainnet copy vaults on Kuru, Kuru Flow referrer fee as revenue. |

## Bounties

| Bounty | What Kadd ships | Where |
|--------|-----------------|-------|
| **Nansen** | Smart-money PnL leaderboard drives the Smart Money tab, SMART badges, wallet cards, "trading now" with copy backtests, one-click Backtest / Auto-copy, the agent API and skills. One paid call a day, shared. | [`NANSEN.md`](NANSEN.md) |
| **Kuru — Consumer Trading App** | "Live · Kuru" on every token page: buy/sell on Monad mainnet routed by Kuru Flow (quote → review with minimum → passkey signs). Optional referrer fee (`KURU_REFERRER`, `KURU_REFERRER_BPS`) is the revenue path. Retention: Telegram alerts (work with Kadd closed) and in-app notifications when a followed wallet trades or a vault copies; the keeper skips copied buys of tokens the risk engine rates critical. Next: `KaddCopyKuru`, auto copy on mainnet through Kuru Flow, built and fork-tested on a real route. `KaddClub` is also fork-tested against Kuru Spot V2. Target users, demand and retention: see Founder & Traction above (✍️). | [`kadd/src/lib/kuru.ts`](kadd/src/lib/kuru.ts), [`KuruTrade.tsx`](kadd/src/components/KuruTrade.tsx) |
| **Agora — Best Mobile Trading App** | `/perps`, mobile first and in the phone nav: **Mera** passkey login (no wallet app), **AUSD** balance in the wallet and in Perpl, **Perpl** trades (long / short with leverage, close, withdraw) signed by the passkey on the Exchange contract. On mainnet, Get AUSD swaps MON → AUSD on Kuru inside Kadd, so one passkey goes MON → AUSD → perps position. | [`perplTrade.ts`](kadd/src/lib/perplTrade.ts), [`PerpsTrade.tsx`](kadd/src/components/PerpsTrade.tsx) |
| **Perpl — API / Analytics / Risk** | **`/perps/risk`**: liquidation map per market ("a 5% drop liquidates $X of longs"), the positions closest to liquidation, TVL, 30-day volume and trades from Perpl's daily candles, and from the indexer: net deposits, liquidations and new accounts per day plus a live feed of the latest liquidations. **Wallet risk profile**: equity, margin use, distance to liquidation per position, **all-time PnL** (live equity minus net deposits, so fees and funding are included), deposits / withdrawals and liquidation history; **compare** up to four wallets; **alerts** in-app and on Telegram when a position nears liquidation. Perps · Perpl leaderboard: per market 24h volume, open interest, long/short split, average leverage, funding and positions within 5% of liquidation; every open position on Perpl mainnet read from the Exchange contract (size, entry, mark, leverage, open PnL, liquidation price), all-time PnL and liquidation count per trader (equity from the contract, deposits / withdrawals from the Envio indexer, Perpl on chain 143), a "Perps on Perpl" panel on every wallet page. **Kadd copy bot**: mirrors a chosen mainnet trader on Perpl testnet through the API with a budget, a leverage cap and band-based reconciling (trade-only key, never withdraws). | [`perpl.ts`](kadd/src/lib/perpl.ts), [`perplBot.ts`](kadd/src/lib/perplBot.ts), [`docs/perpl-setup.md`](docs/perpl-setup.md) |
| **Envio** | HyperIndex indexer for every Kadd contract: dynamic pool / club registration, swaps attributed to the owner of the funds across strategies, copy vaults and copy clubs, per-trader and daily aggregates, **multichain**: Kadd on Monad testnet plus Perpl perps on Monad mainnet (markets with their decimals from `ContractAdded`, every account with deposits / withdrawals, every liquidation valued in USD, flows per day). Perpl's high-volume events (~50k closes a day) are deliberately left out so the whole history (~36k events) fits Envio Cloud's free plan; open positions come from the contract and PnL from equity minus net deposits. Live on Envio Cloud, synced via HyperSync. The app reads it (Stats, leaderboard) and uses HyperRPC for event history and an on-chain chart fallback. | [`indexer/`](indexer/) |
| **Mera — UX** | Mera is the whole account layer: one passkey ceremony, PRF → signing session, prompt-free signing, automatic gas for new accounts, same account on testnet and mainnet. Stateless: clear site data or switch device, sign in with the same passkey, same address. | [`kadd/src/lib/wallet.ts`](kadd/src/lib/wallet.ts) |
| Monad Community | ✍️ Only if the team is in an onboarded community (set on the portal profile). | — |

Not pursued: MetaMask Agent Wallet (needs its plugin template and an Agent Wallet ≥ 6.2 to test against — Kadd's
skills already cover "copy trading with limits" with `cast`), Mera "One Passkey, Many Keys", Agora.

## Demo video (≤ 3 min, live product)

The story in one line: **find a trader → check their risk → follow them with limits** (spot copy vault or perps), all
from one passkey. Record on a phone-width window for the first and the perps parts (Agora asks for mobile), desktop
for the rest.

**Before recording**
- An account with gas, tUSDC and some testnet AUSD in Perpl (deposit once on `/perps` so the trade step is one tap).
- An active copy vault that has copied at least once (vault #0 or #1), so its page shows live copies.
- Pick the trader for scene 4 on Leaderboard → Perps · Perpl: an open position at moderate leverage in BTC or ETH.
- Open every page once so the data is warm, and turn on notifications.

| Time | Show | Say |
|------|------|-----|
| 0:00 | Phone width. Landing → **Try it in 60 seconds** → passkey → gas arrives → **Copy** a trader's latest buy | "No wallet app, no seed phrase. One passkey, gas sent for you, and my first real trade confirms in under a minute." Show the timer. |
| 0:25 | Leaderboard → **Smart Money** → open a wallet → **Copy backtest** | "Nansen shows who is actually profitable on Monad. Before I follow anyone, I replay their real trades: what would copying them have returned?" |
| 0:45 | **Start auto copy**: $5 per buy, $20 a day → the vault page with its copied trades | "Not a bot with my keys: a vault whose limits the contract enforces. The keeper only decides *when*. I can withdraw everything anytime." |
| 1:05 | Leaderboard → **Perps · Perpl**: the markets table, then a trader's row → their wallet's **Perps on Perpl** panel | "Same idea for perps. Every Perpl position on Monad, read from the contract: size, leverage, open PnL, and how far each one is from liquidation." Point at **Away**, all-time PnL and the liquidation history. |
| 1:25 | **Trade like this** → `/perps` ticket prefilled (market, side, leverage) → the liquidation price and warning → **Long** → filled → **Your positions** | "One tap copies their setup. Before I sign I see my margin, fee and liquidation price, and Kadd warns me if the leverage is too tight. My passkey signs straight on Perpl: AUSD in, position open, no API key." |
| 1:55 | `/perps/risk`: the **liquidation map** for BTC, hover a bar; **Closest to liquidation**; **Latest liquidations** | "Where would the cascade start? A 5% drop in BTC liquidates this much in longs. These are the traders closest to the edge right now." |
| 2:15 | Token page → **Live · Kuru** quote and review (or `/perps` mainnet → **Get AUSD**) | "Ready for real money? The same account trades mainnet through Kuru, and swaps MON into AUSD for Perpl, with the guaranteed minimum shown first." |
| 2:30 | Groups → **Copy clubs** / Share card / Invite link | "Do it with friends: a copy club pools money into one vault with the same limits. Every invite is recorded onchain." |
| 2:45 | **Stats** (Kadd + Perps on Perpl) → AI Agents | "Everything here is onchain and indexed with Envio across two chains, and AI agents can use it too. Kadd: see who's winning, follow them safely." |

## Pitch video (≤ 2 min)

1. **Problem (20 s)** — ✍️ your first user. People copy traders by screenshot: late, unsized, on trust, or they hand
   their keys to a bot. On perps it's worse: you copy someone's 15× without seeing they're 2% from liquidation.
2. **Insight (15 s)** — Monad is fast enough for following to happen onchain, with the rules in a contract instead of
   a promise, and every position is public, so risk can be shown before you copy.
3. **Product (45 s)** — **Find** who's winning (Nansen smart money, every Monad wallet, every Perpl trader).
   **Check** their risk (copy backtest, all-time PnL, liquidation history, distance to liquidation, the liquidation map). **Follow** with limits:
   a spot copy vault or copy club the contract caps, or a perps position from your passkey with its liquidation price
   shown first. One passkey from testnet practice to mainnet (Kuru, Perpl, AUSD).
4. **Traction (20 s)** — ✍️ numbers from Stats (trades, wallets, copies, invites joined and traded) and anything
   outside the app (community, users you talked to).
5. **Team & next (20 s)** — ✍️ team. Next: the mainnet copy vault on Kuru (built and fork-tested), copy-perps for every
   user with a delegated trade-only key, revenue from Kuru referrer and Perpl builder fees.

## Judge access

- Open https://kaad-app.vercel.app → **Sign in** → create a passkey. Gas is sent automatically; test USDC is claimed
  on the first buy.
- Mainnet trading needs real MON in the account and is optional to try; everything else is free.
- Repo: ✍️ public link, or access granted to `metropolis@hackathon.monad.xyz`.
