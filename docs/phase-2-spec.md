# Kadd phase 2 — spec

Six features that turn "a terminal you can copy traders with" into a product people come back to and share.
Ordered by build sequence: each one ships on its own, with its checks, before the next starts.

| # | Feature | Moves | Effort |
|---|---------|-------|--------|
| F1 | Copy social proof ("N copying") | Design, Traction | S |
| F2 | 60-second first trade | Mera UX bounty, Design | S |
| F3 | Shareable cards | Traction (acquisition) | S |
| F4 | Notifications | Retention (Kuru bounty asks for it) | S |
| F5 | Copy Clubs | Originality, Technical | M |
| F6 | Mainnet auto copy via Kuru | Kuru bounty, Technical, path forward | M |

Shared rule for every data feature: no new per-request calls to rate-limited upstreams. Testnet history comes from
the one shared `kaddLogs()` read (5-minute cache) or the indexer; mainnet data from the existing caches.

---

## F1 — Copy social proof

**Why.** A leaderboard of strangers is a list; "12 people copy this wallet with $600" is a signal, and it shows
traction on every screen.

**Data.** Extend `kaddLogs()` with `KaddCopy.Funded` and `KaddCopy.Closed`. Derive per leader:
`{ copiers: active vaults, deposited: Σ deposit + funding of active vaults, copies: Copied events }`.
`copyStats()` returns `Map<leader, …>` — computed from the cached logs, zero extra requests.

**UI.**
- Wallet page header: "👥 3 copying · $60 in vaults · 8 trades copied" (hidden when 0).
- Mainnet board and Smart Money board rows: a small "N copying" chip next to the wallet.
- Stats: a "Copy trading" indicator (active vaults, copied trades).

**API.** `copiers`, `copyDepositedUsd` on agent wallet and leaderboard rows.

**Done when.** Numbers match `KaddCopy` state for the two live test vaults; no extra HyperRPC request per page.

## F2 — First trade in 60 seconds

**Why.** Mera's bounty is judged on time-to-first-transaction, and judges try the app cold.

**Flow** (`/start`, linked from the landing hero and the onboarding checklist):
1. **Create your account** — one passkey ceremony (existing `openLogin`). Gas drip fires automatically.
2. **Pick who to follow** — three cards: the top wallets with the most copy-worthy record (Nansen smart money first,
   else mainnet board by Copy ROI with ≥ 3 trades), each with its latest buy of a Kadd-listed token.
3. **Copy their latest buy** — one tap: `buyToken(token, 10)` (claims test USDC automatically) and follows the wallet.
4. **Done** — "Your first trade confirmed in **42 s**" with the tx link, plus next steps: start auto copy, open the
   Following feed, share.

**Timer.** Starts on first `/start` render (sessionStorage), stops at the confirmed receipt. Shown on the done screen;
the best time is kept per device (localStorage, convenience only).

**Edge cases.** Gas not arrived → step waits and shows "Sending you gas…" with a retry; no candidates → fall back to
CHOG; a failed buy keeps the user on step 3 with the error.

**Done when.** A fresh browser goes landing → confirmed testnet trade with one passkey prompt and three taps.

## F3 — Shareable cards

**Why.** Every good copy result should be an ad: a link that previews well on X / Telegram and lands on Kadd.

**Images** (`next/og`, 1200×630, `opengraph-image.tsx` next to each page so Next adds `og:image` itself):
- `/wallet/[address]` — blockie, name, Nansen 30-day PnL + win rate, else copy-backtest ROI, "N copying".
- `/vault/[id]` — "Auto-copying 0xf70d…", return, trades copied, vault limits.

**Pages.**
- Root `metadataBase` (production URL on Vercel) and `twitter:card = summary_large_image`.
- `/vault/[id]` — public read-only page for a copy vault: leader, limits, value vs deposit, copied trades, CTA
  "Copy the same wallet" → leader's wallet page `#auto-copy`.

**Share button** on wallet page and vault rows: copy link + "Post on X" intent with prefilled text.

**Done when.** Both images render in production and the X card validator shows them.

## F4 — Notifications

**Why.** Copy trading is only useful if you hear about it; it's the retention loop.

**What fires.**
- A followed wallet trades a Kadd-listed token (from `/api/feed`).
- One of my vaults copied a trade (new: `/api/copy/activity?owner=` from `kaddLogs`).

**How.** `ActivityWatcher` in the app layout polls every 60 s while any tab is open, diffs against the last seen tx
(localStorage), and raises a toast plus a browser `Notification` when permission is granted. A "Notify me" control
on the Following feed requests permission. Background web push (service worker + VAPID + subscription storage) is out
of scope for the hackathon; noted as next step.

**Done when.** With the tab open, a new copy in my vault produces a toast and a system notification once.

## F5 — Copy Clubs

**Why.** Kadd's two primitives together: friends pool funds into one vault that auto-copies a leader, with
contract-enforced limits and permissionless exit. Nobody else has this.

**Contract** `KaddCopyClubs` (testnet, one deployment holding many clubs):
- `create(name, leader, perTradeBps, dailyCapBps, copySells)` → id. Rules are immutable after creation.
- `deposit(id, amount)`: allowed **only while the club is flat** (holds no tokens), shares = amount × supply / cash
  (1:1 for the first deposit). Same rule as `KaddClub`: pricing positions at a manipulable pool price never happens.
- `redeem(id, shares)`: **in kind and always available** — pro-rata cash plus pro-rata of every token held.
- Keeper `copyBuy(id, source, leaderTx, minOut)`: spends `perTradeBps` of current cash; total buys per UTC day at
  most `dailyCapBps` of the cash held when the day's first buy happened. `copySell` exits the whole position.
  Same guarantees as `KaddCopy`: only the venue's pool for the token, each leader trade once, output stays in the club.
- Views: `get`, `count`, `sharesOf`, `held`, `poolsOf`, `isFlat`.
- Events: `ClubCreated`, `Deposited`, `Redeemed`, `Copied`.

**Keeper.** Extends the existing keeper: active clubs are planned exactly like vaults.

**UI.** Groups & Clubs → "Copy clubs" section: cards (leader, limits, members, value, status Deposits open / Holding),
create form (also reachable from a wallet page: "Start a copy club for this wallet"), deposit, redeem.

**Tests.** Foundry: share math, flat-only deposits, in-kind redeem, limits, keeper-only, once-per-leader-trade,
second member joining, exit while holding. Fork E2E with the real keeper. Deploy to testnet, Sourcify verify.

## F6 — Mainnet auto copy via Kuru

**Why.** Closes the story: practise on testnet, then follow for real on mainnet, routed through Kuru.

**Contract** `KaddCopyKuru` (mainnet): `KaddCopy`'s rules, but vaults hold MON and trades go through Kuru Flow's
router with calldata from the Kuru Flow API:
- Router address allow-listed by the admin (`setRouter`); the keeper passes `(token, data, minOut)`.
- `copyBuy`: sends at most `perTrade` MON as `value`, then checks the vault's **own token balance rose by at least
  `minOut`** — so calldata that routes output anywhere else reverts.
- `copySell`: approves exactly the position to the router, calls it, checks the vault's **MON balance rose by at
  least `minOut`**, resets the approval.
- `pause()` by admin stops new copies; `close()` by the owner always works (even paused).
- Per-trade and daily caps, one copy per leader trade, as on testnet.

**Trust model (documented in the contract and UI).** As on testnet the keeper picks the timing, and here also the
route; the contract bounds the damage of a bad route by `perTrade`/`dailyCap` and keeper-supplied `minOut`. The UI
recommends small limits.

**Tests.** Foundry unit tests with a mock router (output redirected → revert, under-delivery → revert, caps, pause,
close). Fork test against Monad mainnet with a real Kuru Flow quote whose `userAddress` is the vault.

**Not in this phase.** Deploying it: it holds real funds, so deployment (and its admin key) is the team's decision.
The app wires it behind `NEXT_PUBLIC_COPY_MAINNET`; empty = the mainnet option shows "coming soon".

---

## Delivery

Branch `feat/phase-2`, one commit per feature, one PR to `dev`. Every feature passes typecheck, lint, its self-check
or Foundry tests, and the production build before the next starts. README and `SUBMISSION.md` updated at the end.
