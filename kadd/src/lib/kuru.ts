import { getAddress, type Address } from "viem";

// Deployment addresses come from env (see .env.example); the defaults are the current Monad testnet deployments.
const env = (value: string | undefined, fallback: Address): Address => getAddress(value || fallback);

// Kuru Spot V2, Monad testnet (https://kuru-testnet-docs.mintlify.site/deployments/testnet).
export const USDC = env(process.env.NEXT_PUBLIC_USDC, "0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1");
export const USDC_DECIMALS = 6;
export const CLUB_FACTORY = env(process.env.NEXT_PUBLIC_CLUB_FACTORY, "0xcF7e32d79553aA97259724bb780b951115F5b647");

export type Market = {
  address: Address;
  symbol: string;
  base: Address;
  decimals: number;
  pricePrecision: number;
  /** Base atoms still treated as "flat" (~1 cent), so leftover dust doesn't block deposits. */
  dust: bigint;
};

export const MARKETS: Market[] = [
  { address: "0x26cd68436B6A4AEB3ec52abC20A4d121f8B4BAc9", symbol: "MON", base: "0x0000000000000000000000000000000000000000", decimals: 18, pricePrecision: 1e6, dust: 10n ** 15n },
  { address: "0x9d187971B64505Ac81f12c5FD2ac9c5247Ec62F3", symbol: "WETH", base: "0x63c84e18184021c6CcE5ea57d0c3Ec0E65f3b303", decimals: 18, pricePrecision: 100, dust: 10n ** 12n },
  { address: "0x8661cB7c5f4f8ae3ee116B63Aa5a23c69110e357", symbol: "WBTC", base: "0x7cDC77B348a2E101C766aD290367f3c5F287af18", decimals: 8, pricePrecision: 100, dust: 10n },
  { address: "0x0E2A5D9378fB61B8eC100Bd770c449F6fdD3e4d6", symbol: "XAUT", base: "0x7553b18A8c8400a1b7746C1F5b4f453D57555838", decimals: 6, pricePrecision: 100, dust: 1n },
  { address: "0x4A0888C502e64AEAE11115508Ec0955c70293dba", symbol: "USDT", base: "0xF7d4179FC134D7Cb6BA3D26B2fb556Ff8903B666", decimals: 6, pricePrecision: 1e6, dust: 10_000n },
];

export const marketOf = (address: string) => MARKETS.find((m) => m.address.toLowerCase() === address.toLowerCase());

const EMPTY_BID = 2 ** 32 - 1; // bestBidAsk() sentinel for "no bids"

/** Display prices from the raw bestBidAsk() pair; null when that side of the book is empty. */
export function bookPrices(m: Market, [bid, ask]: readonly [number, number]) {
  return {
    bid: bid === EMPTY_BID || bid === 0 ? null : bid / m.pricePrecision,
    ask: ask === 0 ? null : ask / m.pricePrecision,
  };
}
