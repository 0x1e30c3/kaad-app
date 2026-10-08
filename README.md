# Kadd

**Follow Monad's smart money safely.** Kadd shows you who is actually winning on Monad, lets you backtest copying
them on real trades, practise at real prices, and then auto-copy them from a vault whose limits a contract enforces —
alone, or pooled with friends in an onchain club. When you're ready, the same account trades live on Monad mainnet
through Kuru.

**Live:** https://kaad-app.vercel.app · Monad testnet for practice, Monad mainnet for market data and live trades via
Kuru · Submission notes: [`SUBMISSION.md`](SUBMISSION.md)

## For judges: try it in 3 minutes

No wallet, extension or seed phrase needed. Fastest path: **Try it in 60 seconds** on the landing page (`/start`):
passkey, gas, copy a trader's latest buy, with a timer from arrival to the confirmed trade.

1. **Sign in** (top right) and create a passkey (Face ID / Touch ID / Windows Hello). Your account is derived from
   the passkey with [Mera](https://github.com/category-labs/mera); nothing secret is stored. A new account gets a
   little testnet MON for gas automatically.
2. **Find someone worth following.** Leaderboard → **Smart Money** shows wallets Nansen labels as profitable on
   Monad, with real 30-day PnL. **Monad mainnet** shows everyone trading Kadd's tokens right now, with a **Copy ROI**
   backtest per wallet.
3. **Check them.** Open a wallet: its recent trades, holdings, `.nad` name, and **Copy backtest** — what copying it
   with $10 per buy would have returned.
4. **Follow them.**
   - One tap: **Copy $10** on any of their trades buys the same token on Kadd testnet (1,000 free test USDC are
     claimed for you).
   - Automatic: **Start auto copy** funds a `KaddCopy` vault. New trades by that wallet are copied within minutes,
     never more than your per-trade and daily limits, and **Stop & withdraw** returns everything anytime.
5. **Trade together.** Groups & Clubs → **Create club**: friends pool test USDC, the captain trades within a cap the
   contract enforces, and anyone can exit with their share at any time.

Also: **Share** on a wallet or copy vault (`/vault/<id>`) gives a link whose preview card shows its numbers; **Notify me**
on the Following feed raises a notification when a followed wallet trades or one of your vaults copies a trade (while
Kadd is open in a tab).

Also worth a look: any token page (live chart 1m–1D, **Live · Kuru** to trade on mainnet, a 0–100 risk score with the reason for every point, limit /
take-profit / stop-loss / DCA orders that execute onchain), **Stats** (activity read from the contracts), and
**AI Agents** (skills that let Claude, Cursor or Codex use Kadd).

Re-open the site on another device or after clearing site data: signing in with the same passkey restores the same
account.

## What's real

| | Source |
|---|---|
| Token lists, prices, charts, trades | Monad **mainnet**, live (CoinGecko onchain API, DexScreener) |
| Wallets, smart money, copy backtests | Monad **mainnet** trades + Nansen smart-money PnL + Nad Name Service |
| Swaps, clubs, strategies, auto copy | Monad **testnet**, real transactions on Kadd's contracts with free test USDC |
| Live trades (**Live · Kuru**) | Monad **mainnet**, real funds, routed through Kuru's order books by Kuru Flow |
| Groups feed and PnL | Demo data (groups aren't onchain yet; clubs are) |

Kuru's testnet order books are empty and only list governance-whitelisted tokens, so trading runs on `KaddVenue`, a
testnet stand-in with Kuru's AccountCore / OrderBook interface: one constant-product pool per mainnet token, opened
at its mainnet price. `KaddClub` runs unchanged on both and is fork-tested against real Kuru.

## How auto copy stays safe

```
leader trades on Monad mainnet ──► keeper sees it ──► KaddCopy.copyBuy / copySell ──► Kadd pool (testnet)
                                    (decides when)     (decides what's allowed)
```

`KaddCopy` only trades Kadd's own pool for that token, spends at most `perTrade` per buy and `dailyCap` per UTC day,
copies each leader trade once, keeps the output in the follower's vault, and lets the owner close at any time. The
keeper can't move funds anywhere else. 16 Foundry tests plus an end-to-end fork test with the real keeper.

**Copy clubs** (`KaddCopyClubs`) apply the same rules to a pooled vault: limits are a share of the club's cash,
deposits only while the club holds no tokens (so nobody joins at a manipulated price), and every member can redeem
their share in kind at any time. **Mainnet** (`KaddCopyKuru`): MON vaults trading through the Kuru Flow router; a buy
must raise the vault's own token balance by the quoted minimum, a sell approves exactly the position. Both are tested
(16 and 15 Foundry tests, plus a keeper fork run and a mainnet fork test on a real Kuru Flow route) and **not deployed
yet**: the app shows them once `NEXT_PUBLIC_COPY_CLUBS` / `NEXT_PUBLIC_COPY_MAINNET` are set.

## Contracts (Monad testnet, all Sourcify verified)

| Contract | Address |
|---|---|
| KaddVenue (pools + tUSDC faucet) | [`0xe4c0…5379`](https://testnet.monadexplorer.com/address/0xe4c0c88a4b2e5b150D3bB8D3d391E6A87b3d5379) |
| KaddCopy (auto copy vaults) | [`0x27bB…1661`](https://testnet.monadexplorer.com/address/0x27bB7D06AF7BA8Ea359CFe00A628145ED0Bf1661) |
| KaddClubFactory (clubs on the venue) | [`0x4E24…624c`](https://testnet.monadexplorer.com/address/0x4E24bA0762624EAa63E02f3834105efa423A624c) |
| KaddClubFactory (clubs on Kuru Spot V2) | [`0xcF7e…b647`](https://testnet.monadexplorer.com/address/0xcF7e32d79553aA97259724bb780b951115F5b647) |
| KaddStrategies (limit / TP / SL / DCA) | [`0xC126…cEA`](https://testnet.monadexplorer.com/address/0xC12684b7063e3C749f0227539601a7b370073cEA) |
| KaddCopyClubs (pooled auto copy) | not deployed yet ([`script/DeployCopyClubs.s.sol`](contracts/script/DeployCopyClubs.s.sol)) |
| KaddCore · tUSDC | `0x3F86…DA70` · `0x9173…80CB` |

Every deployment, deploy transaction and seeded pool: [`contracts/deployment.json`](contracts/deployment.json).

## Integrations

- **Nansen**: smart-money PnL leaderboard → Smart Money tab, SMART badges, wallet cards, agent API. Details and
  credit budget: [`NANSEN.md`](NANSEN.md).
- **Envio**: HyperRPC for event history (stats, Kadd leaderboard, PnL attribution, on-chain chart fallback) and a
  HyperIndex indexer of every Kadd contract: [`indexer/`](indexer/).
- **Kuru**: live mainnet trading — Kuru Flow quotes and builds the swap, the passkey session signs it, with a review step
  showing the guaranteed minimum. `KaddClub` is also fork-tested against Kuru Spot V2.
- **Mera**: the whole account layer — passkey PRF → signing session, prompt-free signing, no seed phrase.
- **Nad Name Service**: `.nad` names and avatars for wallets.
- **AI agents**: five skills ([`skills/`](skills/)) and a public JSON API (`/api/agent/help`). Trades come back as
  `cast` plans the agent signs with its own key; Kadd never sees one.

## Repository

| Path | What |
|---|---|
| [`kadd/`](kadd/) | Next.js 16 app (App Router, React 19, Tailwind 4, viem) |
| [`contracts/`](contracts/) | Foundry: KaddVenue, KaddClub(+Factory), KaddStrategies, KaddCopy, KaddCopyClubs, KaddCopyKuru, tests, deploy scripts |
| [`indexer/`](indexer/) | Envio HyperIndex indexer for the Kadd contracts |
| [`skills/`](skills/) | Agent skills (`npx skills add maulana-tech/kaad-app`) |

### Run locally

```sh
cd kadd
cp .env.example .env.local   # optional keys: COINGECKO_API_KEY, ENVIO_API_TOKEN, NANSEN_API_KEY, DRIP_PRIVATE_KEY
npm install && npm run dev   # http://localhost:3000

cd ../contracts && forge test
```

Self-checks for the data logic: `npx tsx --conditions=react-server src/lib/<name>.check.ts` (cache, market, onchain,
wallets, keeper, leaderboard, events).
