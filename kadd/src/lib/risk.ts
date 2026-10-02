// Risk analysis: turns live market signals into a 0–100 risk score with plain-language reasons. Rule-based and
// deterministic (same inputs → same answer), so every point of the score can be explained. No LLM involved.
import type { Risk } from "./mock";

export type Level = "low" | "medium" | "high" | "critical";
export type Severity = "critical" | "high" | "medium" | "low" | "good";
export type Factor = { id: string; severity: Severity; points: number; title: string; detail: string };
export type RiskAnalysis = { score: number; level: Level; factors: Factor[]; summary: string; advice: string[] };

export type RiskInput = {
  symbol: string;
  liq: number;
  mc: number;
  createdAt: number;
  change: { h1: number; h24: number };
  vol: { h24: number };
  txns: { h1: { buys: number; sells: number } };
  holders: number | null;
  score: number | null; // GeckoTerminal trust score
  honeypot: boolean | null;
  verified: boolean | null;
  trades: { usd: number; trader: string }[] | null;
};

const usd = (n: number) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "K" : n.toFixed(0));

export function analyzeRisk(t: RiskInput, now = Date.now()): RiskAnalysis {
  const f: Factor[] = [];
  const add = (id: string, severity: Severity, points: number, title: string, detail: string) => f.push({ id, severity, points, title, detail });
  const ageH = (now - t.createdAt) / 36e5;

  if (t.honeypot) add("honeypot", "critical", 70, "Looks like a honeypot", "Simulations show you may not be able to sell this token after buying it.");

  if (t.liq < 5_000) add("liq", "high", 25, "Almost no liquidity", `Only ${usd(t.liq)} in the pool. Even a small sale will crash the price, and you may not get out.`);
  else if (t.liq < 25_000) add("liq", "medium", 12, "Thin liquidity", `${usd(t.liq)} in the pool. Larger trades will move the price a lot.`);
  else if (t.liq >= 100_000) add("liq", "good", 0, "Deep liquidity", `${usd(t.liq)} in the pool, so trades fill close to the shown price.`);

  if (t.mc > 0 && t.liq / t.mc < 0.02 && t.liq >= 5_000)
    add("liqmc", "medium", 10, "Liquidity is small next to market cap", `Only ${((t.liq / t.mc) * 100).toFixed(1)}% of the market cap is in the pool. If holders sell, the price can fall fast.`);

  if (ageH < 1) add("age", "high", 20, "Brand new", "The pool is less than an hour old. Most rugs happen in the first hours.");
  else if (ageH < 24) add("age", "medium", 10, "Less than a day old", "The pool opened today, so there's little history to judge it by.");
  else if (ageH >= 24 * 30) add("age", "good", 0, "Established", `Trading for ${Math.round(ageH / 24)} days.`);

  if (t.holders != null) {
    if (t.holders < 100) add("holders", "high", 15, "Very few holders", `${t.holders} wallets hold it. A handful of people control the price.`);
    else if (t.holders < 500) add("holders", "medium", 7, "Few holders", `${t.holders.toLocaleString("en-US")} wallets hold it.`);
    else if (t.holders >= 5_000) add("holders", "good", 0, "Widely held", `${t.holders.toLocaleString("en-US")} holders.`);
  }

  if (t.score != null) {
    if (t.score < 35) add("score", "high", 15, "Low trust score", `GeckoTerminal rates it ${Math.round(t.score)}/100 based on pool, transactions, holders and token info.`);
    else if (t.score < 50) add("score", "medium", 7, "Mediocre trust score", `GeckoTerminal rates it ${Math.round(t.score)}/100.`);
    else if (t.score >= 70) add("score", "good", 0, "Good trust score", `GeckoTerminal rates it ${Math.round(t.score)}/100.`);
  }

  const { buys, sells } = t.txns.h1;
  if (buys + sells >= 20 && sells > buys * 2)
    add("selling", "medium", 8, "Heavy selling right now", `${sells} sells vs ${buys} buys in the last hour.`);

  if (Math.abs(t.change.h1) > 30) add("vol1h", "medium", 8, "Extreme price swings", `${t.change.h1 > 0 ? "+" : ""}${t.change.h1.toFixed(0)}% in the last hour.`);
  else if (Math.abs(t.change.h24) > 60) add("vol24h", "low", 5, "Very volatile today", `${t.change.h24 > 0 ? "+" : ""}${t.change.h24.toFixed(0)}% in 24 hours.`);

  if (t.liq > 0 && t.vol.h24 / t.liq > 10)
    add("turnover", "medium", 6, "Unusually high turnover", `24h volume is ${(t.vol.h24 / t.liq).toFixed(0)}× the pool. That can mean bots or wash trading.`);

  if (t.trades && t.trades.length >= 10) {
    const total = t.trades.reduce((s, x) => s + x.usd, 0);
    const byWallet = new Map<string, number>();
    for (const x of t.trades) byWallet.set(x.trader, (byWallet.get(x.trader) ?? 0) + x.usd);
    const top = Math.max(...byWallet.values());
    if (total > 0 && top / total > 0.4)
      add("whale", "medium", 8, "One wallet dominates trading", `A single wallet made ${Math.round((top / total) * 100)}% of the recent trade volume.`);
  }

  if (t.mc > 0 && t.mc < 50_000) add("microcap", "low", 5, "Micro-cap", `Market cap is ${usd(t.mc)}. Tiny caps move violently both ways.`);
  if (t.verified === false) add("unverified", "low", 3, "No verified project info", "The team hasn't verified socials or website with the data provider.");

  const score = Math.min(100, f.reduce((s, x) => s + x.points, 0));
  const level: Level = t.honeypot || score >= 60 ? "critical" : score >= 35 ? "high" : score >= 15 ? "medium" : "low";
  const order: Severity[] = ["critical", "high", "medium", "low", "good"];
  f.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || b.points - a.points);

  const concerns = f.filter((x) => x.severity !== "good");
  const strengths = f.filter((x) => x.severity === "good");
  const lead = { low: "looks relatively healthy", medium: "has some yellow flags", high: "is risky", critical: "is very dangerous to trade" }[level];
  const summary = [
    `${t.symbol} ${lead}.`,
    concerns.length ? `Main concern${concerns.length > 1 ? "s" : ""}: ${concerns.slice(0, 2).map((x) => x.title.toLowerCase()).join(" and ")}.` : "",
    strengths.length ? `On the plus side: ${strengths.slice(0, 2).map((x) => x.title.toLowerCase()).join(" and ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const advice = {
    low: ["Size positions as usual; even healthy tokens can drop 20%+ in a day."],
    medium: ["Keep the position small.", "Set a stop-loss so a dump doesn't wipe you out."],
    high: ["Only use money you're fine losing.", "Set a stop-loss right after buying.", "Check the trades tab for who is buying."],
    critical: ["Avoid. If you trade it anyway, use a tiny amount and test selling first."],
  }[level];

  return { score, level, factors: f, summary, advice };
}

/** Collapses the analysis into the 3-step badge used across lists. */
export const badgeOf = (level: Level): Risk => (level === "low" ? "safe" : level === "medium" ? "caution" : "danger");
