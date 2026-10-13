/** One column of the home workspace: icon + title bar, an optional controls row, and a body that scrolls on its own
 * (on phones the page scrolls instead, and the footer moves above the list so its controls stay in reach). */
export default function Pane({ icon, title, meta, controls, children, footer }: { icon: React.ReactNode; title: string; meta?: React.ReactNode; controls?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col bg-panel md:h-full md:min-h-0">
      <header className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-line">
        <span className="text-muted [&>svg]:size-4">{icon}</span>
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {meta && <span className="ml-auto text-[11px] text-faint">{meta}</span>}
      </header>
      {controls && <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-line">{controls}</div>}
      <div className="max-md:order-1 md:flex-1 md:min-h-0 md:overflow-y-auto md:overscroll-contain">{children}</div>
      {footer && <div className="shrink-0 px-3 py-2 max-md:border-b md:border-t border-line text-[11px] text-muted">{footer}</div>}
    </section>
  );
}

/** Segmented tabs used in pane control rows (Memes/Stocks, 1h/4h… on pump.fun). */
export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex p-0.5 rounded-md bg-raised text-[12px] font-medium">
      {options.map(([v, text]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)} className={`h-7 px-2.5 rounded tabular-nums whitespace-nowrap ${value === v ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}
