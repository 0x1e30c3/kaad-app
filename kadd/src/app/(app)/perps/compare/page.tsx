import Link from "next/link";
import { isAddress } from "viem";
import { perpBoard, walletRisk, type WalletRisk } from "@/lib/perpl";
import { short } from "@/lib/mock";
import { PageHeader, card } from "@/components/ui";
import WalletAvatar from "@/components/WalletAvatar";

export const metadata = { title: "Compare perps traders · Kadd", description: "Perpl traders side by side: margin, leverage, distance to liquidation, all-time PnL, liquidations." };

const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;

type Row = [label: string, value: (r: WalletRisk) => string, better?: "high" | "low", score?: (r: WalletRisk) => number | null];
const leverage = (r: WalletRisk) => {
  const n = r.open.reduce((s, p) => s + p.notional, 0);
  return n ? r.open.reduce((s, p) => s + p.leverage * p.notional, 0) / n : 0;
};
const nearest = (r: WalletRisk) => Math.min(...r.open.map((p) => p.distance), Infinity);
const ROWS: Row[] = [
  ["Equity", (r) => money(r.equity), "high", (r) => r.equity],
  ["Margin in use", (r) => `${r.marginUse.toFixed(0)}%`, "low", (r) => r.marginUse],
  ["Open positions", (r) => String(r.open.length)],
  ["Average leverage", (r) => (r.open.length ? `${leverage(r).toFixed(1)}×` : "–"), "low", (r) => (r.open.length ? leverage(r) : null)],
  ["Closest to liquidation", (r) => (Number.isFinite(nearest(r)) ? `${(nearest(r) * 100).toFixed(1)}% away` : "–"), "high", (r) => (Number.isFinite(nearest(r)) ? nearest(r) : null)],
  ["Open PnL", (r) => signed(r.open.reduce((s, p) => s + p.pnl, 0)), "high", (r) => r.open.reduce((s, p) => s + p.pnl, 0)],
  ["All-time PnL", (r) => (r.history ? signed(r.history.allTime) : "–"), "high", (r) => r.history?.allTime ?? null],
  ["Net money in", (r) => (r.history ? money(r.history.deposited - r.history.withdrawn + r.history.fromProtocol) : "–")],
  ["Liquidations", (r) => (r.history ? String(r.history.liquidations.length) : "–"), "low", (r) => r.history?.liquidations.length ?? null],
  ["Liquidated (USD)", (r) => (r.history ? money(r.history.liquidatedUsd) : "–"), "low", (r) => r.history?.liquidatedUsd ?? null],
];

/** Up to four Perpl traders side by side; the best value in each row is highlighted. */
export default async function ComparePage(props: PageProps<"/perps/compare">) {
  const q = await props.searchParams;
  const raw = (Array.isArray(q.w) ? q.w.join(",") : (q.w ?? "")).split(/[\s,]+/).filter((a) => isAddress(a, { strict: false }));
  const wallets = raw.length ? [...new Set(raw.map((a) => a.toLowerCase()))].slice(0, 4) : ((await perpBoard().catch(() => null))?.rows.slice(0, 3).map((r) => r.address) ?? []);
  const risks = await Promise.all(wallets.map((a) => walletRisk(a).catch(() => null)));
  const cols = wallets.map((a, i) => ({ address: a, risk: risks[i] })).filter((c): c is { address: string; risk: WalletRisk } => !!c.risk);

  return (
    <div className="p-3 md:p-5 flex flex-col gap-4">
      <PageHeader title="Compare perps traders" desc="Perpl traders side by side before you copy one: how much they risk, how close they are to liquidation, and how they've done.">
        <Link href="/perps/risk" className="text-[12px] font-medium text-muted hover:text-fg underline-offset-4 hover:underline">Risk dashboard →</Link>
      </PageHeader>

      <form action="/perps/compare" className={`${card} p-3 flex-row flex-wrap items-center gap-2`}>
        <label htmlFor="w" className="text-[12px] text-muted">Wallets (up to 4, comma separated)</label>
        <input id="w" name="w" defaultValue={wallets.join(", ")} className="flex-1 min-w-[240px] h-9 px-3 rounded-md bg-raised font-mono text-[12px] outline-none border border-transparent focus:border-line-strong" />
        <button className="h-9 px-4 rounded-md bg-brand-fill text-[#0a0a0a] text-[13px] font-semibold">Compare</button>
      </form>

      {!cols.length ? (
        <p className={`${card} p-6 text-[13px] text-muted`}>None of these wallets has a Perpl account. Pick traders from Leaderboard → Perps · Perpl.</p>
      ) : (
        <section className={`${card} overflow-x-auto`}>
          <table className="w-full text-[13px] tabular-nums">
            <thead>
              <tr className="border-b border-line">
                <th className="w-44" />
                {cols.map((c) => (
                  <th key={c.address} className="px-3 py-3 text-left font-medium">
                    <Link href={`/wallet/${c.address}#perps`} className="inline-flex items-center gap-2 hover:underline">
                      <WalletAvatar address={c.address} size={24} />
                      <span className="font-mono">{short(c.address)}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, value, better, score]) => {
                const scores = score ? cols.map((c) => score(c.risk)) : [];
                const valid = scores.filter((x): x is number => x !== null);
                const best = better && valid.length > 1 ? (better === "high" ? Math.max(...valid) : Math.min(...valid)) : null;
                return (
                  <tr key={label} className="h-10 border-b border-line last:border-0">
                    <th className="pl-4 text-left text-[12px] font-medium text-muted">{label}</th>
                    {cols.map((c, i) => (
                      <td key={c.address} className={`px-3 ${best !== null && scores[i] === best ? "font-semibold text-up" : ""}`}>{value(c.risk)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
