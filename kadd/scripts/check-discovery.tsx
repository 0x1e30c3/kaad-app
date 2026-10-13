/** Offline rendering regression checks. Run: node --import tsx scripts/check-discovery.tsx */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import Trenches from "../src/components/Trenches";
import TrendingBoard from "../src/components/TrendingBoard";
import Header, { Sidebar } from "../src/components/Header";
import type { MarketSnapshot, MarketToken } from "../src/lib/market";

const router: AppRouterInstance = {
  bfcacheId: "discovery-test",
  back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {},
};
const render = (node: ReactNode) => renderToStaticMarkup(
  <AppRouterContext.Provider value={router}><PathnameContext.Provider value="/trenches">{node}</PathnameContext.Provider></AppRouterContext.Provider>,
);
const token: MarketToken = {
  address: "0x1234567890123456789012345678901234567890", symbol: "LONGTOKEN".repeat(8), name: "Long token name ".repeat(8), image: null,
  pool: "pool", dex: "dex", createdAt: 1_790_000_000_000, price: 0.5, mc: 15000, liq: 1000, risk: "danger",
  change: { m5: 1, h1: 2, h6: 3, h24: -4 }, vol: { m5: 1, h1: 2, h6: 3, h24: 4 },
  txns: { m5: { buys: 1, sells: 2 }, h1: { buys: 1, sells: 2 }, h6: { buys: 1, sells: 2 }, h24: { buys: 1, sells: 2 } },
};
const base: MarketSnapshot = { tokens: [token], error: false, stale: false, updatedAt: 1_790_000_000_000 };
const cols = (snapshot: MarketSnapshot) => ["new", "hot", "top"].map((key) => ({ key, title: key, hint: "Market data", ...snapshot }));
for (const Board of [Trenches, TrendingBoard]) {
  const populated = render(<Board cols={cols(base)} />);
  assert.match(populated, /High risk/);
  assert.match(populated, /Review practice buy/);
  assert.match(populated, /tUSDC/);
  assert.match(populated, /Practice/);
  assert.match(populated, /\/token\/0x1234567890123456789012345678901234567890/);
  const failed = render(<Board cols={cols({ ...base, tokens: [], updatedAt: null, error: true })} />);
  assert.match(failed, /Market data unavailable/);
  assert.match(failed, /Retry/);
  assert.doesNotMatch(failed, /Nothing here right now|No tokens in this category yet/);
  const empty = render(<Board cols={cols({ ...base, tokens: [] })} />);
  assert.match(empty, /Nothing here right now|No tokens in this category yet/);
  assert.doesNotMatch(empty, /Market data unavailable/);
  const stale = render(<Board cols={cols({ ...base, stale: true })} />);
  assert.match(stale, /Stale · last available data/);
  assert.match(stale, /\/token\/0x1234567890123456789012345678901234567890/);
}
const chrome = render(<><Sidebar /><Header /></>);
const logos = chrome.match(/<a\b[^>]*aria-label="Kadd landing page"[^>]*>/g) ?? [];
assert.equal(logos.length, 3);
for (const logo of logos) assert.match(logo, /href="\/"/);
assert.match(chrome, /aria-label="Navigation"/);
for (const path of ["trenches", "trending", "perps", "portfolio", "groups", "leaderboard", "stats", "agents"]) assert.ok(chrome.includes(`href="/${path}"`));
console.log("discovery rendering ok: populated, error, empty, stale, practice review, navigation, landing links");
