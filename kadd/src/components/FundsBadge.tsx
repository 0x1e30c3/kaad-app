/** Keep the execution environment visible beside balances and order actions. */
export default function FundsBadge({ real = false }: { real?: boolean }) {
  return <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${real ? "bg-down/15 text-down" : "bg-warn/15 text-warn"}`}>{real ? "Real Funds" : "Practice"}</span>;
}
