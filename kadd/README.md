# Kadd

Social trading terminal on Monad: trade with friends, follow each other's moves, and pool funds into onchain clubs on Kuru.

## Run

```sh
npm install
npm run dev            # http://localhost:3000
npm run build && npm run lint
```

Point the app at a local fork instead of the public Monad testnet RPC:

```sh
anvil --fork-url https://testnet-rpc.monad.xyz --port 8547
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8547 npm run dev
```

## What is real and what is demo

| Area | Status |
|---|---|
| Passkey account (Mera) | Real. Passkey PRF → BIP-39/32 `m/44'/60'/0'/0/0` → in-memory signing session. Nothing secret is stored; only the credential id and address. |
| Clubs (`/groups` → Club onchain, `/clubs/[address]`) | Real, Monad testnet. KaddClub contracts on Kuru Spot V2 (see `../contracts`). |
| Tokens, Trenches, Trending, token pages | Demo data (`src/lib/mock.ts`). Kuru testnet only lists majors and its books are currently empty. |
| Buy/sell buttons, portfolio, social groups, leaderboard | Simulated in the browser (`src/lib/store.ts`, localStorage). |

Search the code for `ponytail:` to find the deliberate shortcuts that still need a real backend.

## Routes

- `/` landing page (`src/app/page.tsx`, `src/components/landing/*`)
- `/trenches`, `/trending`, `/token/[address]`, `/groups`, `/clubs/[address]`, `/leaderboard`, `/portfolio` — the app (`src/app/(app)/*`, shared header and status bar in `(app)/layout.tsx`)

## Layout

- `src/lib/wallet.ts` passkey account, viem clients
- `src/lib/club.ts` KaddClub reads/writes, error messages
- `src/lib/kuru.ts` Kuru testnet addresses and markets
- `src/lib/abi.ts` generated from `../contracts` (`node ../contracts/export-abi.mjs`)
- `src/lib/store.ts` client state (session, demo trading, groups)
- `src/lib/mock.ts` demo market data
