# Phase 3: Perps on Kadd (Perpl), AUSD, mobile

Goal: make Kadd the place where you **find** a good perps trader and **trade like them from one passkey**, on testnet
for free or on mainnet with AUSD. Targets: Agora "Best Mobile Trading App" (Mera login + AUSD balance + a Perpl trade),
Perpl "API" and "Analytics / Risk Tool", Mera "Best UX", Envio (multichain indexer).

## Findings that shape the plan (verified)

| Question | Answer | How it was checked |
|---|---|---|
| Can a plain EOA (a Kadd passkey account) trade on Perpl without an API key? | **Yes.** `createAccount(amountCNS)` opens an account for `msg.sender`, `execOrder(orderDesc)` trades for it. `whitelistingEnabled()` is `false` on both networks. | Fork of Monad testnet: a brand-new address got 150 AUSD, opened account #990 with 120 AUSD, market-bought ~$100 BTC at 2× (one fill, $50.16 margin), closed it (−$0.01 PnL, balance 119.92 after fees). |
| Order types on-chain | `0` OpenLong, `1` OpenShort, `2` CloseLong, `3` CloseShort (the REST/WS API uses 1–4). | Perpl SDK `RequestType`, fork run. |
| Market orders | IOC limit order with a price bound (mark ± slippage), `lastExecutionBlock = head + order_ttl_blocks`. | Fork run. |
| Minimum account | 100 AUSD on testnet, 10 AUSD on mainnet (`getMinAccountOpenCNS`). | On-chain read. |
| Mark price freshness | Orders revert with `MarkPriceAgeExceedsMax` if the mark is older than 60 s (oracle stale). | Fork run (stale fork). Show a clear error. |
| AUSD | Mainnet `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`, testnet `0xa9012a055bd4e0edff8ce09f960291c09d5322dc`, 6 decimals. | Perpl context API. |

## F7. Trade perps from your passkey (Agora + Perpl + Mera)

**Page `/perps`** (mobile first, also in the nav):

1. **AUSD card**: AUSD in the wallet and in the Perpl account (balance, locked), on the selected network
   (testnet ↔ mainnet switch, same pattern as Live · Kuru).
2. **Fund**: deposit AUSD into Perpl (first deposit creates the account: one approve + one `createAccount`, or
   `depositCollateral` afterwards). **Withdraw** back to the wallet.
   - Testnet: if the gas-drip wallet holds testnet AUSD, a new account gets 150 AUSD automatically with its gas
     (one per account). Otherwise the card links to Perpl's testnet app / Discord.
   - Mainnet: **Get AUSD** swaps MON → AUSD through Kuru Flow (existing quote route), so the flow is passkey → MON →
     AUSD → Perpl without leaving Kadd.
3. **Order ticket**: market (BTC, ETH, SOL, MON, …), Long / Short, size in USD, leverage 1–10× (default 2×), shows
   entry ≈ mark, margin, approximate liquidation price and fee. One tap, signed by the passkey session without a
   prompt. Errors are mapped to plain language (stale mark, not enough margin, below minimum size).
4. **Positions**: open positions with size, entry → mark, leverage, open PnL, liquidation price; **Close** per
   position.
5. **Copy a trade**: on the Perps leaderboard and the wallet "Perps on Perpl" panel, **Trade like this** prefills
   the ticket with that trader's market, side and leverage (capped) at the size you choose.

Code: `lib/perplTrade.ts` (client: balances, deposit, withdraw, open, close, error mapping), `components/PerpsTrade.tsx`,
`app/(app)/perps/page.tsx`. The leverage cap and minimum sizes are enforced by Perpl's contract; Kadd adds a UI cap
(10×) and shows the liquidation price before signing.

Check: `perplTrade.check.ts` for order building (lot rounding, price bound per side, close sizes) and the liquidation
estimate; a fork script (testnet) that runs open → close through the same functions.

## F8. Perps analytics (Perpl "Analytics / Risk")

On `/perps` below the ticket, and per wallet:

- **Protocol**: per market 24h volume, open interest, long/short skew (from on-chain positions), funding rate,
  mark vs oracle; total OI and positions; **at-risk positions** (within 5% of liquidation; 10% would flag every position above ~7× leverage) and the leverage
  distribution. Sources: Perpl public ticker / funding endpoints + the contract.
- **Wallet**: realized PnL, win rate, closes, liquidations (indexer), open book with liquidation prices; best / worst
  market (indexer per-day rows).

## F8b. Risk tool (built)

- **`/perps/risk`**: TVL (AUSD held by the Exchange), open interest, 24h volume, positions within 5% of liquidation;
  a **liquidation map** per market (notional liquidated per 1% price move, ±30%, plus "a 2 / 5 / 10% move wipes out
  $X of longs / shorts"); the 25 positions closest to liquidation; 30-day charts from the indexer (volume, fees,
  active traders, cumulative net deposits, liquidations, new accounts).
- **Wallet risk profile** (wallet page): equity, margin in use, free AUSD, open PnL, distance to liquidation per
  position; with the indexer: realized PnL, win rate, profit factor, max drawdown, win / loss streaks, average hold,
  best / worst market, cumulative PnL curve and recent closes.
- **`/perps/compare?w=a,b,c,d`**: up to four traders side by side, best value per row highlighted.
- **Alerts**: in-app (every minute while Kadd is open) and Telegram (with Kadd closed) when one of my Perpl positions
  comes within 5%, then 2%, of liquidation; the order ticket warns when the chosen leverage leaves less than a 15%
  move before liquidation.
- **Indexer** (chain 143): `PerplMarket` (decimals, from `ContractAdded`), `PerplDaily` (volume from maker fills,
  maker + taker fees, active traders, new accounts, deposits / withdrawals, liquidations), `PerplClose` (every
  realized event with hold time), `PerplPosition` (open time). Start block moved to 54,773,000 so the first markets'
  `ContractAdded` is indexed.

Checks: `perplRisk.check.ts` (liquidation buckets and cumulative sums, wallet performance), indexer replay test
(markets, closes, daily totals on real mainnet blocks).

## F9. Mera: one passkey, many keys (blocked on Perpl)

Derive the Perpl API key (Ed25519) from the passkey PRF with a `perpl-api-v1` salt: nothing stored, the same key on
any device, revocable on Perpl. Needs Perpl to whitelist `kaad-app.vercel.app` for key enrollment. Until then: plan
only (question listed in `docs/perpl-setup.md`).

## Not doing now

MetaMask Agent Wallet plugin (needs Agent Wallet ≥ 6.2 to test), Dynamic / Privy (conflict with Mera as the account
layer), Kuru New Markets (different product).

## Order of work

1. F7 core: `perplTrade.ts` + check, `/perps` page with AUSD card, fund / withdraw, ticket, positions.
2. Testnet AUSD drip (when the drip wallet holds AUSD) and mainnet Get AUSD via Kuru.
3. Trade like this from the leaderboard and wallet panel.
4. F8 analytics.
5. Verification: fork run of the client functions, browser check on mobile width, `next build`, docs.
