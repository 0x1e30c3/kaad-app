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
| **Envio** | HyperIndex indexer for every Kadd contract: dynamic pool / club registration, swaps attributed to the owner of the funds across strategies, copy vaults and copy clubs, per-trader and daily aggregates. The app reads it (Stats, leaderboard) and uses HyperRPC for event history and an on-chain chart fallback. | [`indexer/`](indexer/) |
| **Mera — UX** | Mera is the whole account layer: one passkey ceremony, PRF → signing session, prompt-free signing, automatic gas for new accounts, same account on testnet and mainnet. Stateless: clear site data or switch device, sign in with the same passkey, same address. | [`kadd/src/lib/wallet.ts`](kadd/src/lib/wallet.ts) |
| Monad Community | ✍️ Only if the team is in an onboarded community (set on the portal profile). | — |

Not pursued: MetaMask Agent Wallet (needs its plugin template and an Agent Wallet ≥ 6.2 to test against — Kadd's
skills already cover "copy trading with limits" with `cast`), Mera "One Passkey, Many Keys", Agora, Perpl.

## Demo video (≤ 3 min, live product)

| Time | Show | Say |
|------|------|-----|
| 0:00 | Landing → **Try it in 60 seconds** → passkey → copy a trader | "No wallet, no seed phrase. One passkey, gas sent for you, first real trade in under a minute." Show the timer. |
| 0:20 | Leaderboard → **Smart Money** | "Nansen tells us who's actually profitable on Monad, 30-day PnL." |
| 0:40 | Click **Backtest** on a wallet | "What would copying them have returned? Real trades, real prices." |
| 1:00 | **Copy $10** on one of their trades | "One tap: same token, on Kadd testnet with free test USDC." |
| 1:20 | **Start auto copy**: $5 per buy, $20 a day | "A vault, not a bot with my keys: the contract enforces these limits, I can withdraw anytime." Show the live copy tx. |
| 1:50 | Token page: chart timeframes, risk score | "Every trade shows the minimum you get and why a token is risky." |
| 2:10 | Switch to **Live · Kuru**, quote, review | "When you're ready, the same account trades on mainnet, routed through Kuru's order books." |
| 2:30 | **Create club** | "Or do it together: pooled funds, captain capped by the contract, anyone can exit." |
| 2:45 | Stats + AI Agents page | "All onchain, indexed with Envio, and usable by AI agents." |

## Pitch video (≤ 2 min)

1. **Problem (20 s)** — ✍️ your first user: people copy traders by screenshot, late, with no limits, or hand their
   keys to a bot.
2. **Insight (20 s)** — On Monad, settlement is fast enough that copying can happen onchain with enforced rules.
3. **Product (40 s)** — See who's winning (Nansen), test it (backtest + practice), follow it safely (copy vault,
   clubs), go live (Kuru).
4. **Traction (20 s)** — ✍️ numbers from Stats.
5. **Team & next (20 s)** — ✍️ team; next: deploy the mainnet copy vault on Kuru (built and fork-tested), referrer-fee revenue, mobile.

## Judge access

- Open https://kaad-app.vercel.app → **Sign in** → create a passkey. Gas is sent automatically; test USDC is claimed
  on the first buy.
- Mainnet trading needs real MON in the account and is optional to try; everything else is free.
- Repo: ✍️ public link, or access granted to `metropolis@hackathon.monad.xyz`.
