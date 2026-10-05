# Nansen in Kadd

Kadd is a social trading terminal on Monad. Nansen tells you **who** is consistently profitable on Monad; Kadd turns
that into something you can **act on safely**: backtest copying the wallet, practise at real prices, then auto-copy it
from a vault whose limits a contract enforces, alone or as a club.

## What we call

| Endpoint | Category | Credits | Used for |
|----------|----------|---------|----------|
| `POST /api/v1/smart-money/pnl-leaderboard` (`chains: ["monad"]`, `timeframe: 30`) | Smart Money | 5 | Every Nansen feature below |
| `GET /api/v1/account` | Account | 0 | Checking the credit balance during development |

One paid call powers the whole product. Code: [`kadd/src/lib/nansen.ts`](kadd/src/lib/nansen.ts).

## Where it shows up

1. **Leaderboard → Smart Money tab** ([`SmartMoneyBoard.tsx`](kadd/src/components/SmartMoneyBoard.tsx)).
   - Nansen-labelled Monad wallets ranked by 30-day PnL, with realized PnL, win rate, trades, top tokens and
     Nansen's label.
   - **Trading now**: the smart-money wallets that just traded a token you can trade on Kadd, with a copy backtest
     computed from their real trades.
   - Every row has **Backtest** and **Auto-copy** actions. That's the step from intelligence to action.
2. **SMART badge** on the live Monad mainnet board, for wallets Nansen labels as smart money
   ([`MainnetBoard.tsx`](kadd/src/components/MainnetBoard.tsx)).
3. **Wallet page card**: Nansen label and 30-day PnL across all of the wallet's Monad trades, next to Kadd's own copy
   backtest and the auto-copy form ([`wallet/[address]/page.tsx`](kadd/src/app/(app)/wallet/[address]/page.tsx)).
4. **AI agents**: the public agent API exposes it as `GET /api/agent/leaderboard?board=smart` and as
   `nansenSmartMoney` on wallet profiles. The `kadd-smart-money` and `kadd-wallet` skills ([`skills/`](skills/)) use it
   to answer "who is actually profitable on Monad, and should I copy them?", then hand off to `kadd-trade` for a
   limit-guarded auto copy.

## From insight to action

```
Nansen smart money  →  Kadd copy backtest  →  paper trade at mainnet prices  →  KaddCopy vault (auto copy)
 "who is profitable"    "what copying them      "practise with test USDC"        per-trade + daily caps,
                         would have returned"                                     withdraw anytime
```

The vault is [`KaddCopy`](contracts/src/testnet/KaddCopy.sol) on Monad testnet
(`0x27bB7D06AF7BA8Ea359CFe00A628145ED0Bf1661`, Sourcify verified). The keeper only decides *when* to copy. The contract
decides *what's allowed*: only Kadd's mirror pool for that token, at most `perTrade` per buy, at most `dailyCap` a day,
each leader trade once, and output that never leaves the follower's vault.

## Credit budget

The free plan gives 100 credits once, then tops up to 10 a day, so the design spends as little as possible:

- **One call, shared by everything.** The response sits in Next.js's Data Cache for 24 hours. It survives restarts
  and is shared across server instances, so page views, badges, wallet pages and agent calls cost 0 credits.
- **Never during `next build`**, so deploys don't spend credits.
- **About 5 credits a day in production**, under the daily top-up.

Measured in development: the first call cost 5 credits; dozens of later page and API views cost 0.

## With more credits

Each of these is one call per refresh, and they plug into existing screens:

- `smart-money/dex-trades` (5): a live "smart money just bought" feed, copyable in one tap from the Following feed.
- `tgm/who-bought-sold` (1): smart-money buyers and sellers on each token page.
- `profiler/address/pnl-summary` (1): full PnL for any wallet, not only labelled smart money.
