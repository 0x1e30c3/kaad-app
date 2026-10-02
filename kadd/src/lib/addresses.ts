import { getAddress, zeroAddress, type Address } from "viem";

// Monad testnet deployments (contracts/README.md). Env overrides them, e.g. for a local fork. Plain module so server
// components can read them too.
const env = (value: string | undefined, fallback: Address) => getAddress(value || fallback);
export const VENUE = env(process.env.NEXT_PUBLIC_VENUE, "0xe4c0c88a4b2e5b150D3bB8D3d391E6A87b3d5379");
export const TUSDC = env(process.env.NEXT_PUBLIC_TUSDC, "0x9173048f7c1D6ebfC72a1932C8d15E3EADE180CB");
export const CLUB_FACTORY = env(process.env.NEXT_PUBLIC_CLUB_FACTORY, "0x4E24bA0762624EAa63E02f3834105efa423A624c");
/** Conditional orders: limit buy, take-profit, stop-loss, DCA (KaddStrategies). */
export const STRATEGIES = env(process.env.NEXT_PUBLIC_STRATEGIES, "0xC12684b7063e3C749f0227539601a7b370073cEA");
/** False only if env explicitly blanks an address; onchain features then say so instead of failing. */
export const VENUE_READY = VENUE !== zeroAddress && TUSDC !== zeroAddress && CLUB_FACTORY !== zeroAddress;
