import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { num, usd } from "@/lib/mock";
import { FRAMES, FRAME_LABEL, ageOf, tokenDetail, type TokenDetail } from "@/lib/market";
import { Pct, RiskBadge, TokenIcon } from "@/components/ui";
import CopyAddress from "@/components/CopyAddress";
import Chart from "@/components/Chart";
import TradePanel from "@/components/TradePanel";
import TokenTabs from "@/components/TokenTabs";
import TokenActions from "@/components/TokenActions";
import AutoRefresh from "@/components/AutoRefresh";

export const revalidate = 30;

export async function generateMetadata(props: PageProps<"/token/[address]">) {
  const t = await tokenDetail((await props.params).address);
  return { title: t ? `${t.symbol} ${usd(t.mc)} · Kadd` : "Token not found · Kadd" };
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  );
}

function SafetyChecks({ t }: { t: TokenDetail }) {
  const failed = t.checks.filter((c) => c.ok === false).length;
  return (
    <section className="p-3 border-t border-line flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[13px]">Safety checks</h3>
        <RiskBadge risk={t.risk} />
      </div>
      <p className="text-[12px] text-muted">
        {failed === 0 ? "No red flags in the data we have." : `${failed} of ${t.checks.length} checks need attention.`} Not financial advice.
      </p>
      <ul className="flex flex-col">
        {t.checks.map(({ label, ok, value }) => (
          <li key={label} className="flex items-center gap-2 py-1.5 border-b border-line last:border-0 text-[12px]">
            {ok === null ? <CircleHelp className="size-3.5 text-faint shrink-0" /> : ok ? <CircleCheck className="size-3.5 text-up shrink-0" /> : <CircleX className="size-3.5 text-down shrink-0" />}
            <span className="flex-1">{label}</span>
            <span className={`tabular-nums font-medium ${ok === false ? "text-down" : ok === null ? "text-faint" : ""}`}>{value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function TokenPage(props: PageProps<"/token/[address]">) {
  const t = await tokenDetail((await props.params).address);
  if (!t) notFound();
  const { candles, trades, ...token } = t;

  return (
    <div className="lg:h-full flex flex-col lg:flex-row">
      <AutoRefresh />
      <div className="flex-1 min-w-0 flex flex-col lg:overflow-auto">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-3 py-3 border-b border-line bg-panel">
          <div className="flex items-center gap-2.5">
            <Link href="/trenches" aria-label="Back" className="grid place-items-center size-7 rounded-md text-muted hover:text-fg hover:bg-hover">
              <ArrowLeft className="size-4" />
            </Link>
            <TokenIcon t={t} size={40} />
            <div>
              <div className="flex items-baseline gap-1.5">
                <h1 className="font-semibold text-[16px] tracking-[-0.01em]">{t.symbol}</h1>
                <span className="text-muted">{t.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-up font-medium" suppressHydrationWarning>{ageOf(t.createdAt)}</span>
                <CopyAddress address={t.address} />
              </div>
            </div>
            <TokenActions t={token} />
          </div>
          <div className="flex flex-col">
            <span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] leading-none">{usd(t.mc)}</span>
            <Pct v={t.change.h24} className="text-[12px] font-medium" />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="Price">{usd(t.price)}</Stat>
            <Stat label="Liquidity">{usd(t.liq)}</Stat>
            <Stat label="Volume 24h">{usd(t.vol.h24)}</Stat>
            <Stat label="Holders">{t.holders == null ? "–" : num(t.holders)}</Stat>
          </div>
        </div>

        <div className="h-[340px] md:h-[400px] shrink-0 px-1 pt-2 border-b border-line bg-panel">
          {candles.length ? <Chart data={candles} /> : <p className="grid h-full place-items-center text-muted">No trades in the last 24 hours.</p>}
        </div>

        <div className="bg-panel flex-1">
          <TokenTabs t={token} trades={trades} />
        </div>
      </div>

      <aside className="w-full lg:w-[340px] shrink-0 lg:border-l border-t lg:border-t-0 border-line bg-panel lg:overflow-auto">
        <div className="grid grid-cols-4 border-b border-line">
          {FRAMES.map((f) => (
            <div key={f} className="py-2 text-center border-r border-line last:border-0">
              <div className="text-[11px] text-muted">{FRAME_LABEL[f]}</div>
              <Pct v={t.change[f]} className="text-[12px] font-medium" />
            </div>
          ))}
        </div>
        <div id="trade" className="scroll-mt-2">
          <TradePanel t={token} />
        </div>
        <SafetyChecks t={t} />
        <div className="h-16 lg:hidden" />
      </aside>

      {/* Mobile: the trade panel sits below the fold, so keep a shortcut pinned above the bottom nav. */}
      <a
        href="#trade"
        className="lg:hidden fixed inset-x-3 bottom-[68px] z-20 h-11 rounded-lg bg-fg text-bg grid place-items-center font-semibold shadow-lg"
      >
        Trade {t.symbol}
      </a>
    </div>
  );
}
