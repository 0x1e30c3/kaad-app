/** Offline checks for review content and explicit market/fund states. */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import QuickBuy from "../components/QuickBuy";
import FundsBadge from "../components/FundsBadge";
import MarketStatus from "../components/MarketStatus";
import type { Risk } from "./mock";
import type { MarketSnapshot } from "./market";

const token = { address: "0x1234", name: "Example Token", symbol: "EX", image: null, price: 1 };
for (const [risk, label] of [["safe", "low screening risk"], ["caution", "Risk caution"], ["danger", "High risk"], [undefined, "Risk unknown"]] as [Risk | undefined, string][]) {
  const html = renderToStaticMarkup(<QuickBuy t={{ ...token, risk }} usd={10} className="" />);
  assert.match(html, /Buy 10 tUSDC/);
  assert.match(html, /Spend 10 tUSDC to buy Example Token \(EX\)/);
  assert.ok(html.includes(label));
  assert.match(html, /<dialog[^>]+aria-label="Review practice buy"/);
  assert.match(html, /Cancel/);
  assert.match(html, /Confirm practice buy/);
}
for (const amount of [0, -1, Infinity, NaN]) {
  const html = renderToStaticMarkup(<QuickBuy t={token} usd={amount} className="" />);
  assert.match(html, /<button[^>]+disabled=""/);
}
assert.match(renderToStaticMarkup(<FundsBadge />), />Practice</);
assert.match(renderToStaticMarkup(<FundsBadge real />), />Real Funds</);
assert.doesNotMatch(renderToStaticMarkup(<FundsBadge />), /hidden/);
const router: AppRouterInstance = { bfcacheId: "safety-test", back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
const base: MarketSnapshot = { tokens: [], updatedAt: Date.UTC(2026, 9, 13, 10), stale: false, error: false };
const status = (data: MarketSnapshot) => renderToStaticMarkup(<AppRouterContext.Provider value={router}><MarketStatus data={data} /></AppRouterContext.Provider>);
assert.match(status(base), /Last updated: 2026-10-13 10:00:00 UTC/);
assert.match(status({ ...base, stale: true }), /Stale · last available data/);
assert.match(status({ ...base, stale: true }), /Retry/);
const failed = status({ ...base, updatedAt: null, error: true });
assert.match(failed, /Market data unavailable/);
assert.match(failed, /Last updated: unavailable/);
assert.match(failed, /Retry/);
console.log("safety UX ok: explicit amount, token identity, all risk levels, invalid amounts, funds badges, timestamps and retry");
