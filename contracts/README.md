# Kadd contracts

`KaddClub`: pooled trading for a friend group on Kuru Spot V2. Members deposit USDC for shares, a captain trades
whitelisted markets within a per-trade cap, and members can always redeem their pro-rata share of every asset.
See the contract header in `src/KaddClub.sol` for the design and trust assumptions.

## Deployments

| Network | Contract | Address |
|---|---|---|
| Monad testnet (10143) | KaddClubFactory v2 (on Kuru) | [`0xcF7e32d79553aA97259724bb780b951115F5b647`](https://testnet.monadexplorer.com/address/0xcF7e32d79553aA97259724bb780b951115F5b647) (Sourcify verified) |
| Monad testnet (10143) | KaddClubFactory v1 | `0x54b16973803397Beb3804774fB1f356d6e30ad27` — deprecated (no griefing/deferred-payout fixes) |
| Monad testnet (10143) | **KaddVenue** (used by the app) | [`0xe4c0c88a4b2e5b150D3bB8D3d391E6A87b3d5379`](https://testnet.monadexplorer.com/address/0xe4c0c88a4b2e5b150D3bB8D3d391E6A87b3d5379) (Sourcify verified) |
| Monad testnet (10143) | KaddCore (venue) | `0x3F8674797756cEbA5A217830b6F74A00Bf89DA70` (verified) |
| Monad testnet (10143) | tUSDC (faucet) | `0x9173048f7c1D6ebfC72a1932C8d15E3EADE180CB` (verified) |
| Monad testnet (10143) | **KaddClubFactory on venue** (used by the app) | `0x4E24bA0762624EAa63E02f3834105efa423A624c` (verified) |
| Monad testnet (10143) | **KaddStrategies** (limit / TP / SL / DCA) | [`0xC12684b7063e3C749f0227539601a7b370073cEA`](https://testnet.monadexplorer.com/address/0xC12684b7063e3C749f0227539601a7b370073cEA) (verified) |

Wired to Kuru AccountCore `0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038` and USDC `0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1`.

All deployments, deploy transactions (hash, block, gas, fee), verification status and the seeded mirror pools are in
[`deployment.json`](./deployment.json). Regenerate it after any deploy with `node export-deployments.mjs`.

## Testnet venue (what the app trades on)

Kuru's testnet books are empty and its USDC is admin-mint only, and Kuru V2 only lists governance-whitelisted tokens,
so nobody can swap there yet. `src/testnet/KaddVenue.sol` is a testnet-only stand-in with the same AccountCore /
OrderBook surface, so `KaddClub` runs on it unchanged:

- `TestUSDC` (tUSDC): free test dollars, 1,000 per address per hour via `faucet()`.
- `KaddVenue.createMirror(source, name, symbol, baseSeed)`: anyone opens one constant-product pool per mainnet token,
  seeded with 50,000 tUSDC against `baseSeed` mirror tokens (the app passes the mainnet price).
- `KaddPool`: x·y=k with a 0.3% fee; `swapExact` for wallets, Kuru-style `swap(userId, …)` for core accounts (clubs).
- A second `KaddClubFactory` points at the venue's core + tUSDC.

Nothing in the venue has value. When Kuru opens its testnet (or on mainnet), point the app back at Kuru.

```sh
forge script script/DeployVenue.s.sol --rpc-url monad_testnet --broadcast --account kadd-deployer
node seed-mirrors.mjs <KaddVenue address>   # prints cast commands that open pools for popular tokens
```

## Commands

```sh
forge test                                                          # unit tests (mock Kuru + venue end to end)
forge test --match-contract Fork --fork-url monad_testnet -vv       # against real Kuru on a testnet fork
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --account kadd-deployer
node export-abi.mjs                                                 # refresh ABIs in ../kadd/src/lib/abi.ts
```

Not audited. Testnet only.
