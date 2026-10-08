import Link from "next/link";
import { ArrowUpRight, Bot, Coins, Copy, Droplets, Layers, Target, UserPlus, Users, Wallet } from "lucide-react";
import { copyStatsFrom, kaddLogs, referralsFrom } from "@/lib/events";
import { getStats } from "@/lib/stats";
import { perpRisk } from "@/lib/perpl";
import { CLUB_FACTORY, COPY, COPY_CLUBS, REFERRALS, STRATEGIES, TUSDC, VENUE } from "@/lib/addresses";
import { EXPLORER } from "@/lib/venue";
import { PageHeader, Pct, TokenIcon, card } from "@/components/ui";
import { ActivityChart, AreaChart, Gauge } from "@/components/charts";
import AutoRefresh from "@/components/AutoRefresh";

export const revalidate = 60;
export const metadata = { title: "Stats · Kadd" };

const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
const int = (n: number) => n.toLocaleString("en-US");
const sig = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const pressureLabel = (v: number) => (v < 20 ? "Strong selling" : v < 45 ? "Selling" : v <= 55 ? "Balanced" : v <= 80 ? "Buying" : "Strong buying");

export default async function StatsPage() {
  const [s, logs, perps] = await Promise.all([getStats(), kaddLogs().catch(() => null), perpRisk().catch(() => null)]);
  const vaults = [...(logs ? copyStatsFrom(logs) : new Map()).values()].reduce((a, c) => ({ n: a.n + c.copiers, copies: a.copies + c.copies, usd: a.usd + c.depositedUsd }), { n: 0, copies: 0, usd: 0 });
  const a = s.activity;
  const buys = sum(s.pools.map((p) => p.buys24h));
  const sells = sum(s.pools.map((p) => p.sells24h));
  const pressure = buys + sells > 0 ? (buys / (buys + sells)) * 100 : 50;
  const members = new Set(logs?.clubDeposits.map((l) => l.args.member!.toLowerCase()));
  const invites = [...(logs ? referralsFrom(logs) : new Map()).values()].reduce((a, r) => ({ n: a.n + r.invited.length, active: a.active + r.active.length }), { n: 0, active: 0 });
  const live = (a: string) => !/^0x0+$/.test(a);
  const contracts: [string, string][] = [["Venue", VENUE], ["tUSDC", TUSDC], ["Club factory", CLUB_FACTORY], ["Strategies", STRATEGIES], ["Copy vaults", COPY], ["Copy clubs", COPY_CLUBS], ...(live(REFERRALS) ? [["Invites", REFERRALS] as [string, string]] : [])];
  const indicators: [React.ReactNode, string, string, string][] = [
    [<Users key="u" />, "Unique wallets", a ? int(a.traders) : "–", "traded at least once"],
    [<Droplets key="d" />, "Pool liquidity", money(s.poolLiquidity), `${s.pools.length} markets`],
    [<Layers key="l" />, "Clubs", int(s.clubs), a ? `${int(a.deposits)} deposits` : "pooled trading"],
    [<Wallet key="w" />, "tUSDC in clubs", money(s.clubTvl), "held by club contracts"],
    [<Copy key="cp" />, "Copy vaults", int(vaults.n), `${int(vaults.copies)} trades copied · ${money(vaults.usd)} in`],
    [<Bot key="cc" />, "Copy clubs", logs ? int(logs.clubCreated.length) : "–", `${int(members.size)} members · ${int(logs?.clubCopied.length ?? 0)} trades copied`],
    ...(live(REFERRALS) ? [[<UserPlus key="r" />, "Invited wallets", logs ? int(invites.n) : "–", `${int(invites.active)} went on to trade`] as [React.ReactNode, string, string, string]] : []),
    [<Target key="t" />, "Strategies", s.strategies === null ? "–" : int(s.strategies), "limit · TP / SL · DCA"],
    [<Coins key="c" />, "Faucet claims", int(s.faucetClaims), "1,000 tUSDC each"],
  ];

  return (
    <div className="p-3 md:p-5 flex flex-col gap-5">
      <AutoRefresh seconds={60} />
      <PageHeader title="Network stats" desc="Live activity on Kadd, read from its contracts on Monad testnet. Prices are the mainnet tokens each market mirrors." />
      {s.staleSince && <p className="-mt-3 text-[12px] text-warn">Monad testnet is rate-limiting right now; these numbers may be a few minutes old.</p>}

      {s.pools.length > 0 && (
        <section className="-mx-3 px-3 md:mx-0 md:px-0 flex gap-3 overflow-x-auto snap-x pb-1">
          {s.pools.map((p) => (
            <Link key={p.pool} href={`/token/${p.source.toLowerCase()}`} className={`${card} snap-start shrink-0 w-[200px] md:w-auto md:shrink md:flex-1 md:min-w-[180px] p-3.5 gap-2 hover:border-line-strong`}>
              <div className="flex items-center gap-2">
                <TokenIcon t={{ address: p.source.toLowerCase(), image: p.image }} size={22} />
                <span className="text-[13px] font-semibold truncate">{p.symbol}</span>
                {p.change24h !== null && <Pct v={p.change24h} className="ml-auto text-[12px] font-medium" />}
              </div>
              <div className="text-[18px] font-semibold tabular-nums leading-none">{p.mainnetPrice ? `$${sig(p.mainnetPrice)}` : "–"}</div>
              <AreaChart data={p.spark} height={40} axes={false} kind="price" color={p.change24h === null ? undefined : p.change24h >= 0 ? "var(--up)" : "var(--down)"} />
            </Link>
          ))}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-4">
          <article className={`${card} p-4 gap-3`}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[14px] font-semibold">Buy pressure</h2>
              <span className="text-[11px] text-muted">mainnet · 24h</span>
            </div>
            <Gauge value={pressure} label={buys + sells > 0 ? pressureLabel(pressure) : "No trades yet"} />
            <div className="flex justify-between text-[12px] tabular-nums">
              <span><span className="text-up font-semibold">{int(buys)}</span> <span className="text-muted">buys</span></span>
              <span><span className="text-down font-semibold">{int(sells)}</span> <span className="text-muted">sells</span></span>
            </div>
            <p className="text-[11px] text-faint leading-snug">Share of buys among mainnet trades of the tokens Kadd mirrors.</p>
          </article>

          <article className={`${card} p-1.5`}>
            <ul>
              {indicators.map(([icon, k, v, note]) => (
                <li key={k} className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-hover">
                  <span className="grid place-items-center size-8 rounded-lg bg-raised text-muted [&>svg]:size-4">{icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px]">{k}</span>
                    <span className="block text-[11px] text-faint truncate">{note}</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">{v}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <article className={`${card} p-4 md:p-5 gap-4`}>
          <div>
            <h2 className="text-[16px] font-semibold">Kadd activity</h2>
            <p className="text-[12px] text-muted">Swaps on the Kadd venue, from contract events.</p>
          </div>
          {a ? (
            <ActivityChart hourly={a.hourly} daily={a.daily} allTime={{ trades: a.trades, volume: a.volume }} />
          ) : (
            <p className="py-16 text-center text-[13px] text-muted">Trades and volume need event history; they appear once the Envio HyperRPC token is configured.</p>
          )}
        </article>
      </div>

      {perps && (
        <section className={`${card} p-4 md:p-5 gap-4`}>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-[16px] font-semibold">Perps on Perpl</h2>
            <span className="text-[12px] text-muted">Monad mainnet, read from the Perpl Exchange contract and Kadd&apos;s indexer. Trade them on Kadd at /perps.</span>
            <Link href="/perps/risk" className="ml-auto text-[12px] font-medium text-muted hover:text-fg underline-offset-4 hover:underline">Liquidation map →</Link>
          </div>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {([
              ["Collateral (TVL)", money(perps.tvl), "AUSD in the Exchange"],
              ["Open interest", money(perps.openInterest), "per side"],
              ["24h volume", money(perps.volume24h), `${perps.markets.length} markets`],
              ["Near liquidation", int(perps.near.count), "positions within 5%"],
              ...(perps.daily?.length
                ? ([
                    ["7d volume", money(perps.daily.slice(-7).reduce((a, d) => a + d.volumeUsd, 0)), "from fills"],
                    ["7d fees", money(perps.daily.slice(-7).reduce((a, d) => a + d.feesUsd, 0)), "maker + taker"],
                    ["7d liquidations", int(perps.daily.slice(-7).reduce((a, d) => a + d.liquidations, 0)), money(perps.daily.slice(-7).reduce((a, d) => a + d.liquidatedUsd, 0))],
                    ["Active traders", int(perps.daily.at(-1)?.activeTraders ?? 0), "today"],
                  ] as [string, string, string][])
                : []),
            ] as [string, string, string][]).map(([k, v, note]) => (
              <div key={k} className="rounded-lg bg-raised/60 p-3">
                <div className="text-[12px] text-muted">{k}</div>
                <div className="text-[18px] font-semibold tabular-nums">{v}</div>
                <div className="text-[11px] text-faint">{note}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={`${card} overflow-hidden`}>
        <div className="flex items-baseline gap-2 px-4 pt-4 pb-3">
          <h2 className="text-[15px] font-semibold">Markets</h2>
          <span className="text-[13px] text-faint tabular-nums">{s.pools.length}</span>
        </div>
        {s.pools.length === 0 ? (
          <p className="px-4 pb-5 text-[13px] text-muted">
            No markets yet. The first trade on any token in <Link href="/trenches" className="text-fg underline">Trenches</Link> opens one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] tabular-nums whitespace-nowrap">
              <thead className="text-[11px] text-muted">
                <tr className="border-y border-line">
                  <th className="w-10 py-2.5 font-medium">#</th>
                  <th className="text-left font-medium px-3">Token</th>
                  <th className="text-right font-medium px-3">Price</th>
                  <th className="text-right font-medium px-3">24h %</th>
                  <th className="text-right font-medium px-3 hidden sm:table-cell" title="Price in the Kadd testnet pool">Testnet</th>
                  <th className="text-right font-medium px-3 hidden md:table-cell">Liquidity</th>
                  <th className="text-right font-medium px-3 hidden md:table-cell">Trades</th>
                  <th className="text-right font-medium px-3 hidden md:table-cell">Volume</th>
                  <th className="text-right font-medium px-4 hidden lg:table-cell">Last 24h</th>
                </tr>
              </thead>
              <tbody>
                {s.pools.map((p, i) => {
                  const gap = p.mainnetPrice ? ((p.price - p.mainnetPrice) / p.mainnetPrice) * 100 : null;
                  const href = `/token/${p.source.toLowerCase()}`;
                  return (
                    <tr key={p.pool} className="relative border-b border-line last:border-0 hover:bg-hover">
                      <td className="py-3 text-center text-muted">{i + 1}</td>
                      <td className="px-3">
                        <Link href={href} className="flex items-center gap-2.5 after:absolute after:inset-0">
                          <TokenIcon t={{ address: p.source.toLowerCase(), image: p.image }} size={24} />
                          <span className="font-semibold">{p.symbol}</span>
                        </Link>
                      </td>
                      <td className="px-3 text-right font-medium">{p.mainnetPrice ? `$${sig(p.mainnetPrice)}` : "–"}</td>
                      <td className="px-3 text-right">{p.change24h === null ? "–" : <Pct v={p.change24h} />}</td>
                      <td className="px-3 text-right hidden sm:table-cell">
                        <div>${sig(p.price)}</div>
                        {gap !== null && <div className="text-[11px] text-faint">{gap >= 0 ? "+" : ""}{gap.toFixed(1)}% vs mainnet</div>}
                      </td>
                      <td className="px-3 text-right hidden md:table-cell">{money(p.liquidity)}</td>
                      <td className="px-3 text-right hidden md:table-cell">{p.trades === null ? "–" : int(p.trades)}</td>
                      <td className="px-3 text-right hidden md:table-cell">{p.volume === null ? "–" : money(p.volume)}</td>
                      <td className="px-4 hidden lg:table-cell">
                        <div className="relative z-10 w-28 ml-auto"><AreaChart data={p.spark} height={32} axes={false} fill={false} kind="price" color={p.change24h === null ? undefined : p.change24h >= 0 ? "var(--up)" : "var(--down)"} /></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center gap-2 px-4 h-11 border-b border-line">
          <h2 className="text-[13px] font-semibold">Contracts</h2>
          <span className="ml-auto text-[11px] text-muted">Monad testnet · Sourcify verified</span>
        </div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4">
          {contracts.map(([k, addr]) => (
            <li key={k} className="border-b sm:border-r border-line last:border-0">
              <a href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer" className="group flex items-center gap-3 px-4 py-3 text-[13px] hover:bg-hover">
                <span className="flex-1">
                  <span className="block text-muted text-[12px]">{k}</span>
                  <span className="font-mono text-[12px]">{addr.slice(0, 6)}…{addr.slice(-4)}</span>
                </span>
                <ArrowUpRight className="size-4 text-faint group-hover:text-fg" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
