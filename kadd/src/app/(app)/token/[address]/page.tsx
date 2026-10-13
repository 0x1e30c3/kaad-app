import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { num, usd } from "@/lib/mock";
import { FRAMES, FRAME_LABEL, ageOf, tokenDetail } from "@/lib/market";
import { Pct, TokenIcon } from "@/components/ui";
import CopyAddress from "@/components/CopyAddress";
import TokenChart from "@/components/TokenChart";
import TradePanel from "@/components/TradePanel";
import TokenTabs from "@/components/TokenTabs";
import TokenActions from "@/components/TokenActions";
import RiskPanel from "@/components/RiskPanel";
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

export default async function TokenPage(props: PageProps<"/token/[address]">) {
  const t = await tokenDetail((await props.params).address);
  if (!t) notFound();
  const { trades, ...token } = t;

  return (
    <div className="lg:h-full flex flex-col lg:flex-row">
      <AutoRefresh />
      <div className="flex-1 min-w-0 flex flex-col lg:overflow-auto">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-3 py-3 border-b border-line bg-panel">
          <div className="flex flex-wrap min-w-0 max-w-full items-center gap-2.5">
            <Link href="/trenches" aria-label="Back" className="grid place-items-center size-7 rounded-md text-muted hover:text-fg hover:bg-hover">
              <ArrowLeft className="size-4" />
            </Link>
            <TokenIcon t={t} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap min-w-0 items-baseline gap-1.5">
                <h1 title={t.symbol} className="max-w-full break-all font-semibold text-[16px] tracking-[-0.01em]">{t.symbol}</h1>
                <span title={t.name} className="max-w-full break-words text-muted">{t.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-up font-medium" suppressHydrationWarning>{ageOf(t.createdAt)}</span>
                <CopyAddress address={t.address} />
              </div>
            </div>
            <TokenActions t={token} />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-muted">Market cap / FDV</span>
            <span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] leading-none">{usd(t.mc)}</span>
            <span className="text-[12px] text-muted">Price change 24h <Pct v={t.change.h24} className="font-medium" /></span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="Price">{usd(t.price)}</Stat>
            <Stat label="Liquidity">{usd(t.liq)}</Stat>
            <Stat label="Volume 24h">{usd(t.vol.h24)}</Stat>
            <Stat label="Holders">{t.holders == null ? "–" : num(t.holders)}</Stat>
          </div>
        </div>

        <div className="h-[360px] md:h-[440px] shrink-0 px-1 pt-2 border-b border-line bg-panel">
          <TokenChart pool={t.pool} token={t.address} supply={t.price > 0 ? t.mc / t.price : 0} />
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
        <RiskPanel a={t.analysis} checks={t.checks} />
        <div className="h-16 lg:hidden" />
      </aside>

      {/* Mobile: the trade panel sits below the fold, so keep a shortcut pinned above the bottom nav. */}
      <a
        href="#trade"
        className="lg:hidden fixed inset-x-3 bottom-[calc(var(--mobile-nav-height)+8px)] z-20 h-11 rounded-lg bg-brand-fill text-[#0a0a0a] grid place-items-center font-semibold shadow-lg"
      >
        <span className="max-w-full truncate px-3">Trade {t.symbol}</span>
      </a>
    </div>
  );
}
