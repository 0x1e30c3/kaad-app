// Demo data: the landing preview, plus traders/groups until groups have a backend. Seeded so server & client
// render the same. Live market data lives in market.ts.
import type { TokenRef } from "./market";
// mulberry32
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  ["MOE", "Moe"], ["CHOG", "Chog"], ["MONCAT", "Moncat"], ["NOM", "NomNomNom"],
  ["PEPE", "Pepe Monad"], ["SNAI", "Snail"], ["DOCAT", "Dope Cat"], ["GMONAD", "gMonad"],
  ["WAVE", "Wave Atomic"], ["FOMOE", "Fomo Inu"], ["IUCI", "Luci"], ["MCR", "Monicorn"],
  ["STONKS", "Stonks"], ["DOGGG", "Doggg"], ["GONE", "Guess.one"], ["EMO", "emonad"],
  ["KADDY", "Kaddy"], ["PURPL", "Purple Frog"], ["BLITZ", "Blitz"], ["NADS", "Nads Club"],
];

export type Risk = "safe" | "caution" | "danger";

export type Token = {
  address: string;
  symbol: string;
  name: string;
  hue: number;
  ageMin: number;
  price: number;
  mc: number;
  athMc: number;
  liq: number;
  vol1h: number;
  vol24h: number;
  change1h: number;
  change24h: number;
  buys: number;
  sells: number;
  holders: number;
  top10: number;
  devHold: number;
  snipers: number;
  insiders: number;
  bondingPct: number;
  renounced: boolean;
  lpBurned: boolean;
  verified: boolean;
  risk: Risk;
};

function addr(r: () => number) {
  let s = "0x";
  for (let i = 0; i < 40; i++) s += Math.floor(r() * 16).toString(16);
  return s;
}

export const TOKENS: Token[] = NAMES.map(([symbol, name], i) => {
  const r = rng(i + 7);
  const mc = Math.round(2_000 + r() ** 3 * 9_000_000);
  const top10 = Math.round(5 + r() * 60);
  const devHold = Math.round(r() * 20 * 10) / 10;
  const snipers = Math.round(r() * 15);
  const score = top10 / 60 + devHold / 20 + snipers / 15;
  return {
    address: addr(r),
    symbol,
    name,
    hue: Math.round(r() * 360),
    ageMin: Math.round(1 + r() ** 2 * 60 * 24 * 300),
    price: mc / 1e9,
    mc,
    athMc: Math.round(mc * (1 + r() * 3)),
    liq: Math.round(mc * (0.02 + r() * 0.1)),
    vol1h: Math.round(r() ** 2 * mc * 0.05),
    vol24h: Math.round(r() ** 2 * mc * 0.4),
    change1h: Math.round((r() - 0.5) * 40 * 10) / 10,
    change24h: Math.round((r() - 0.45) * 120 * 10) / 10,
    buys: Math.round(r() * 300),
    sells: Math.round(r() * 250),
    holders: Math.round(10 + r() ** 2 * 35_000),
    top10,
    devHold,
    snipers,
    insiders: Math.round(r() * 10),
    bondingPct: Math.round(r() * 100),
    renounced: r() > 0.3,
    lpBurned: r() > 0.25,
    verified: r() > 0.4,
    risk: score < 0.9 ? "safe" : score < 1.6 ? "caution" : "danger",
  };
});

export type Candle = { time: number; open: number; high: number; low: number; close: number; value: number };

export function candles(t: Token, n = 200): Candle[] {
  const r = rng(t.hue + 1);
  const now = Math.floor(Date.UTC(2026, 9, 2, 10) / 1000);
  let p = t.mc * (1 - t.change24h / 100);
  const out: Candle[] = [];
  for (let i = n; i > 0; i--) {
    const open = p;
    const close = (p = p * (1 + (r() - 0.5) * 0.04));
    out.push({
      time: now - i * 60,
      open,
      close,
      high: Math.max(open, close) * (1 + r() * 0.01),
      low: Math.min(open, close) * (1 - r() * 0.01),
      value: Math.round(r() * t.vol1h * 0.1),
    });
  }
  const k = t.mc / p; // rescale so the last close equals current MC
  return out.map((c) => ({ ...c, open: c.open * k, close: c.close * k, high: c.high * k, low: c.low * k }));
}

export type Trader = { address: string; name: string; hue: number; pnl7d: number; winRate: number; trades: number; volume: number };

const TRADER_NAMES = ["rara", "bimo", "sinta", "dimas", "ayu", "fajar", "nadia", "rizky", "putri", "andre", "maya", "yoga", "intan", "galih", "salsa", "bayu"];

export const TRADERS: Trader[] = TRADER_NAMES.map((name, i) => {
  const r = rng(i + 300);
  return {
    address: addr(r),
    name,
    hue: Math.round(r() * 360),
    pnl7d: Math.round((r() - 0.35) * 4000),
    winRate: Math.round(35 + r() * 45),
    trades: Math.round(5 + r() * 120),
    volume: Math.round(200 + r() ** 2 * 40_000),
  };
});

export type Group = { id: string; name: string; desc: string; code: string; members: string[] };

export const GROUPS: Group[] = [
  { id: "kampus-ui", name: "Anak Kampus UI", desc: "Belajar trading bareng, max 50 USDC per trade", code: "KADD-UI24", members: TRADERS.slice(0, 6).map((t) => t.address) },
  { id: "kantor-sudirman", name: "Kantor Sudirman", desc: "Trading jam istirahat makan siang", code: "KADD-SDRM", members: TRADERS.slice(5, 11).map((t) => t.address) },
  { id: "degen-bandung", name: "Degen Bandung", desc: "Memecoin Monad tiap hari", code: "KADD-BDG1", members: TRADERS.slice(9, 16).map((t) => t.address) },
];

export const getTrader = (address: string) => TRADERS.find((t) => t.address === address);

// Real Monad mainnet memecoins, so links and "follow buy" from the demo group feeds open live token pages.
export const FEED_TOKENS: TokenRef[] = [
  { address: "0x350035555e10d9afaf1566aaebfced5ba6c27777", symbol: "CHOG", name: "Chog", image: "https://coin-images.coingecko.com/coins/images/70930/small/chog.png?1764628221" },
  { address: "0x7b2728c04ad436153285702e969e6efac3a97777", symbol: "MOLANDAK", name: "MOLANDAK", image: "https://assets.geckoterminal.com/jkufydres7iz8y0jg6b4napfdz6s" },
  { address: "0x81a224f8a62f52bde942dbf23a56df77a10b7777", symbol: "emo", name: "emonad", image: null },
  { address: "0xa9da3c77ec7cdc4dfaa1fe142af583543d1c540f", symbol: "FLING", name: "Fling", image: "https://coin-images.coingecko.com/coins/images/102178309/small/fling.jpg?1789273305" },
  { address: "0x3ec7310937281ca4bf89d5bb11704be9b7ff7777", symbol: "ANAGO", name: "ANAGO", image: "https://coin-images.coingecko.com/coins/images/102173551/small/IMG_3774.PNG?1783164540" },
  { address: "0x0a332311633c0625f63cfc51ee33fc49826e0a3c", symbol: "APR", name: "aPriori", image: "https://coin-images.coingecko.com/coins/images/70220/small/capricorn.jpg?1786687781" },
];

export type GroupTrade = { trader: Trader; token: TokenRef; side: "buy" | "sell"; usd: number; agoMin: number };

export function groupFeed(members: string[], n = 14): GroupTrade[] {
  const r = rng(members.length * 31 + members[0]?.charCodeAt(5));
  const ppl = members.map(getTrader).filter(Boolean) as Trader[];
  if (!ppl.length) return [];
  return Array.from({ length: n }, (_, i) => ({
    trader: ppl[Math.floor(r() * ppl.length)],
    token: FEED_TOKENS[Math.floor(r() * FEED_TOKENS.length)],
    side: r() > 0.4 ? "buy" : "sell",
    usd: Math.round(5 + r() * 120),
    agoMin: i * 9 + Math.round(r() * 8),
  }));
}

// Formatting
export const usd = (n: number) =>
  n === 0
    ? "$0"
    : "$" +
      (n >= 1e9 ? (n / 1e9).toFixed(2) + "B"
        : n >= 1e6 ? (n / 1e6).toFixed(2) + "M"
        : n >= 1e3 ? (n / 1e3).toFixed(1) + "K"
        : n >= 1 ? n.toFixed(2)
        : n.toLocaleString("en-US", { maximumSignificantDigits: 3 })); // tiny memecoin prices keep 3 significant digits
export const num = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(Math.round(n)));
export const pct = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1) + "%";
export const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
export const ago = (min: number) => (min < 60 ? `${min}m ago` : `${Math.floor(min / 60)}h ago`);
export const age = (min: number) =>
  min < 60 ? `${min}m` : min < 60 * 24 ? `${Math.floor(min / 60)}h` : `${Math.floor(min / 60 / 24)}d`;
