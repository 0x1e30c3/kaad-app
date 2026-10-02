import { CircleAlert, CircleCheck, CircleHelp, CircleX, OctagonAlert, TriangleAlert, Info, ShieldCheck } from "lucide-react";
import type { Check } from "@/lib/market";
import type { Level, RiskAnalysis, Severity } from "@/lib/risk";

export const LEVEL: Record<Level, { label: string; text: string; bar: string }> = {
  low: { label: "Low risk", text: "text-up", bar: "bg-up" },
  medium: { label: "Medium risk", text: "text-warn", bar: "bg-warn" },
  high: { label: "High risk", text: "text-down", bar: "bg-down" },
  critical: { label: "Critical risk", text: "text-down", bar: "bg-down" },
};

const SEV: Record<Severity, [typeof Info, string]> = {
  critical: [OctagonAlert, "text-down"],
  high: [CircleAlert, "text-down"],
  medium: [TriangleAlert, "text-warn"],
  low: [Info, "text-muted"],
  good: [ShieldCheck, "text-up"],
};

/** Score, summary, reasons and advice for one token, plus the raw checks it was computed from. */
export default function RiskPanel({ a, checks }: { a: RiskAnalysis; checks: Check[] }) {
  const lv = LEVEL[a.level];
  return (
    <section className="p-3 border-t border-line flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[13px]">Risk analysis</h3>
        <span className={`text-[12px] font-semibold ${lv.text}`}>{lv.label}</span>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className={`text-[26px] font-semibold tabular-nums leading-none ${lv.text}`}>{a.score}</span>
          <span className="text-[11px] text-muted">/ 100 risk</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-raised overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={a.score} aria-label="Risk score">
          <div className={`h-full rounded-full ${lv.bar}`} style={{ width: `${Math.max(a.score, 3)}%` }} />
        </div>
      </div>

      <p className="text-[12px] leading-relaxed">{a.summary}</p>

      {a.factors.length > 0 && (
        <ul className="flex flex-col gap-2">
          {a.factors.map((f) => {
            const [Icon, cls] = SEV[f.severity];
            return (
              <li key={f.id} className="flex gap-2 text-[12px]">
                <Icon className={`size-3.5 mt-0.5 shrink-0 ${cls}`} />
                <span>
                  <span className="font-medium">{f.title}</span>
                  <span className="block text-muted leading-snug">{f.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-md bg-raised p-2.5 text-[12px]">
        <div className="font-medium mb-1">What to do</div>
        <ul className="list-disc pl-4 text-muted flex flex-col gap-0.5">
          {a.advice.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>

      <details className="group text-[12px]">
        <summary className="cursor-pointer list-none text-muted hover:text-fg">
          <span className="group-open:hidden">Show raw data ▸</span>
          <span className="hidden group-open:inline">Hide raw data ▾</span>
        </summary>
        <ul className="mt-2 flex flex-col">
          {checks.map(({ label, ok, value }) => (
            <li key={label} className="flex items-center gap-2 py-1.5 border-b border-line last:border-0">
              {ok === null ? <CircleHelp className="size-3.5 text-faint shrink-0" /> : ok ? <CircleCheck className="size-3.5 text-up shrink-0" /> : <CircleX className="size-3.5 text-down shrink-0" />}
              <span className="flex-1">{label}</span>
              <span className={`tabular-nums font-medium ${ok === false ? "text-down" : ok === null ? "text-faint" : ""}`}>{value}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className="text-[10px] text-faint">Automated, rule-based analysis of live data. Not financial advice.</p>
    </section>
  );
}
