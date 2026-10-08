import { getAddress, zeroAddress, type Address } from "viem";

// Monad testnet deployments (contracts/README.md). Env overrides them, e.g. for a local fork. Plain module so server
// components can read them too.
const env = (value: string | undefined, fallback: Address) => getAddress(value || fallback);
export const VENUE = env(process.env.NEXT_PUBLIC_VENUE, "0xe4c0c88a4b2e5b150D3bB8D3d391E6A87b3d5379");
export const TUSDC = env(process.env.NEXT_PUBLIC_TUSDC, "0x9173048f7c1D6ebfC72a1932C8d15E3EADE180CB");
export const CLUB_FACTORY = env(process.env.NEXT_PUBLIC_CLUB_FACTORY, "0x4E24bA0762624EAa63E02f3834105efa423A624c");
/** Conditional orders: limit buy, take-profit, stop-loss, DCA (KaddStrategies). */
export const STRATEGIES = env(process.env.NEXT_PUBLIC_STRATEGIES, "0xC12684b7063e3C749f0227539601a7b370073cEA");
/** Auto copy trading vaults (KaddCopy). Keeper and admin: the gas drip wallet. */
export const COPY = env(process.env.NEXT_PUBLIC_COPY, "0x27bB7D06AF7BA8Ea359CFe00A628145ED0Bf1661");
/** Copy clubs: pooled auto copy vaults (KaddCopyClubs). Keeper: the gas drip wallet. */
export const COPY_CLUBS = env(process.env.NEXT_PUBLIC_COPY_CLUBS, "0x67A974949d2918e07763C86cfe8bbc3E817930D2");
/** Onchain invite attribution (KaddReferrals). */
export const REFERRALS = env(process.env.NEXT_PUBLIC_REFERRALS, "0xFe2FD41200AF425A441261d1c6d6fC5f703B782d");
/** Mainnet auto copy through Kuru (KaddCopyKuru, Monad mainnet). Not deployed: empty shows "coming soon". */
export const COPY_MAINNET = env(process.env.NEXT_PUBLIC_COPY_MAINNET, "0x0000000000000000000000000000000000000000");
/** False only if env explicitly blanks an address; onchain features then say so instead of failing. */
export const VENUE_READY = VENUE !== zeroAddress && TUSDC !== zeroAddress && CLUB_FACTORY !== zeroAddress;
