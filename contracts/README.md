# Kadd contracts

`KaddClub`: pooled trading for a friend group on Kuru Spot V2. Members deposit USDC for shares, a captain trades
whitelisted markets within a per-trade cap, and members can always redeem their pro-rata share of every asset.
See the contract header in `src/KaddClub.sol` for the design and trust assumptions.

## Deployments

| Network | Contract | Address |
|---|---|---|
| Monad testnet (10143) | KaddClubFactory v2 | [`0xcF7e32d79553aA97259724bb780b951115F5b647`](https://testnet.monadexplorer.com/address/0xcF7e32d79553aA97259724bb780b951115F5b647) (Sourcify verified) — current |
| Monad testnet (10143) | KaddClubFactory v1 | `0x54b16973803397Beb3804774fB1f356d6e30ad27` — deprecated (no griefing/deferred-payout fixes) |

Wired to Kuru AccountCore `0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038` and USDC `0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1`.

## Commands

```sh
forge test                                                          # unit tests (mock Kuru)
forge test --match-contract Fork --fork-url monad_testnet -vv       # against real Kuru on a testnet fork
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --account kadd-deployer
node export-abi.mjs                                                 # refresh ABIs in ../kadd/src/lib/abi.ts
```

Not audited. Testnet only.
