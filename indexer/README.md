# Kadd indexer (Envio HyperIndex)

Indexes every Kadd contract on Monad testnet and keeps the aggregates the app shows, so Stats and the Kadd
leaderboard read one GraphQL endpoint instead of scanning raw logs.

| Entity | What |
|--------|------|
| `Pool` | One per mirror pool (registered dynamically from `KaddVenue.MirrorCreated`): trades, buys/sells, volume, last price |
| `Swap` | Every swap, **attributed to whoever's money it was**: the wallet, a club, or the owner of the strategy / copy vault that made it (`kind`) |
| `Trader` | Running totals per wallet or club: trades, volume, bought/sold USD, how many came via strategies or copy |
| `DailyStat` | Network activity per UTC day: trades, volume, new traders, club deposits, copies, strategies |
| `Club`, `ClubDeposit` | Clubs (registered dynamically from `KaddClubFactory.ClubCreated`) and every deposit |
| `Strategy` | Limit / TP / SL / DCA orders and their executions |
| `CopyVault`, `CopyTrade` | Auto-copy vaults, their limits, and every copied trade (copy club trades too, `vault = "club:<id>"`) |
| `CopyClub`, `CopyClubMember` | Copy clubs (`KaddCopyClubs`): rules, members, shares, deposits, redemptions, copies; each member's shares |

`KaddStrategies`, `KaddCopy` and `KaddCopyClubs` swap first and emit their own event after, in the same transaction. The `Swap` is
recorded on the pool event and re-attributed to the vault or strategy owner (or to the Trader `copyclub:<id>`, kind `club`, for a copy club) when that event arrives (`TxSwap` links
the two).

Code: [`config.yaml`](config.yaml) · [`schema.graphql`](schema.graphql) · [`src/handlers/kadd.ts`](src/handlers/kadd.ts)

## Deploy (Envio Cloud)

1. [envio.dev/app](https://envio.dev/app) → sign in with GitHub → **Add indexer** → pick this repository.
2. Root directory `indexer`, config file `config.yaml`, branch `dev`. Deploy; Envio's hosted service syncs it with
   HyperSync from the venue's deploy block.
3. Copy the indexer's GraphQL endpoint and set it in the app (Vercel → Environment Variables):
   `ENVIO_INDEXER_URL=https://indexer.dev.hyperindex.xyz/<id>/v1/graphql`. Without it the app falls back to HyperRPC.

## Test

The test replays real testnet history — the six pools opening, a copy vault being created, and its first live copy of
a mainnet wallet's trade — and checks the copy is credited to the vault owner, not the KaddCopy contract:

```sh
pnpm install
pnpm test                                    # with an Envio token that has HyperSync access
ENVIO_CONFIG=config.rpc.yaml ENVIO_RPC_URL=https://testnet-rpc.monad.xyz pnpm test   # through a plain RPC
```
