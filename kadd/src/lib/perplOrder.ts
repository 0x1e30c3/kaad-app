// Perpl order maths shared by the browser ticket and the server: no network, no React. On-chain order types differ
// from the REST API's (0–3 here, 1–4 there); prices and sizes are integers scaled by each market's decimals.

export type PerpSide = "long" | "short";
export const ORDER = { openLong: 0, openShort: 1, closeLong: 2, closeShort: 3 } as const;

/** Market terms the ticket needs, from Perpl's context (`initial_margin` / `maintenance_margin` are leverage × 100). */
export type PerpTerms = { id: number; name: string; priceDecimals: number; sizeDecimals: number; maxLeverage: number; maintLeverage: number; ttlBlocks: number; takerFee: number };

/** Lots (scaled size) for `usd` of notional at `markPNS`, rounded down so the order never exceeds what was asked. */
export function lotFor(usd: number, markPNS: bigint, t: Pick<PerpTerms, "priceDecimals" | "sizeDecimals">): bigint {
  if (markPNS <= 0n || !(usd > 0)) return 0n;
  // usd / (mark / 10^pd) * 10^sd, kept in integers: usd in micro-dollars to avoid float drift on big notionals.
  const micro = BigInt(Math.floor(usd * 1e6));
  return (micro * 10n ** BigInt(t.priceDecimals) * 10n ** BigInt(t.sizeDecimals)) / (markPNS * 1_000_000n);
}

/** Worst price a market order may fill at: above the mark when buying (open long / close short), below when selling. */
export function boundPrice(markPNS: bigint, buying: boolean, slippageBps = 100): bigint {
  const bps = 10_000n + (buying ? 1n : -1n) * BigInt(slippageBps);
  return buying ? (markPNS * bps + 9_999n) / 10_000n : (markPNS * bps) / 10_000n;
}

/** Approximate liquidation price of a fresh position (Perpl SDK formula with deposit = notional / leverage, no funding). */
export function liquidationPrice(side: PerpSide, entry: number, leverage: number, maintLeverage: number): number {
  const move = 1 / leverage - 1 / maintLeverage; // share of entry the price can move against you
  return Math.max(0, side === "long" ? entry * (1 - move) : entry * (1 + move));
}

export type OrderDesc = {
  orderDescId: bigint;
  perpId: bigint;
  orderType: number;
  orderId: bigint;
  pricePNS: bigint;
  lotLNS: bigint;
  expiryBlock: bigint;
  postOnly: boolean;
  fillOrKill: boolean;
  immediateOrCancel: boolean;
  maxMatches: bigint;
  leverageHdths: bigint;
  lastExecutionBlock: bigint;
  amountCNS: bigint;
  maxNegPnlCollatBPS: bigint;
};

/** A market (IOC) order: open or close `side` for `lot`, bounded by `slippageBps` around the mark, valid for the market's TTL. */
export function marketOrder(o: { terms: PerpTerms; action: "open" | "close"; side: PerpSide; lot: bigint; markPNS: bigint; leverage: number; head: bigint; id?: bigint; slippageBps?: number }): OrderDesc {
  const buying = (o.action === "open") === (o.side === "long");
  const orderType = o.action === "open" ? (o.side === "long" ? ORDER.openLong : ORDER.openShort) : o.side === "long" ? ORDER.closeLong : ORDER.closeShort;
  return {
    orderDescId: o.id ?? BigInt(Date.now()),
    perpId: BigInt(o.terms.id),
    orderType,
    orderId: 0n,
    pricePNS: boundPrice(o.markPNS, buying, o.slippageBps),
    lotLNS: o.lot,
    expiryBlock: 0n,
    postOnly: false,
    fillOrKill: false,
    immediateOrCancel: true,
    maxMatches: 0n,
    leverageHdths: BigInt(Math.round(o.leverage * 100)),
    lastExecutionBlock: o.head + BigInt(o.terms.ttlBlocks),
    amountCNS: 0n,
    maxNegPnlCollatBPS: 1000n,
  };
}

/** Plain-language reason for a Perpl revert (by custom error name), or null to fall back to the generic message. */
export function perplError(name: string | undefined): string | null {
  if (!name) return null;
  const known: Record<string, string> = {
    MarkPriceAgeExceedsMax: "Perpl's price feed is a little behind right now. Try again in a few seconds.",
    OracleAgeExceedsMax: "Perpl's price feed is a little behind right now. Try again in a few seconds.",
    AccountDoesNotExist: "Deposit AUSD first: your first deposit opens your Perpl account.",
    AmountExceedsAvailableBalance: "Not enough AUSD in your Perpl account for this margin. Deposit more or lower the size.",
    AccountFrozen: "This Perpl account is frozen.",
    LotOutOfRange: "Size is outside what this market allows. Try a larger or smaller amount.",
    PriceOutOfRange: "The price moved too far. Try again.",
    PostOrderUnderMinimum: "That's below Perpl's minimum order size.",
    ContractNotOperational: "This market is paused on Perpl right now.",
    ExchangeHalted: "Perpl is halted right now.",
    OrderSizeExceedsAvailableSize: "You're closing more than your position holds.",
    PositionDoesNotExist: "There's no open position to close.",
  };
  return known[name] ?? null;
}
