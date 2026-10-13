"use client";
import { useState } from "react";

type P = { key: string; title: string; node: React.ReactNode };

/**
 * The home workspace, pump.fun style: panes side by side, each scrolling on its own. Desktop shows them all (scrolling
 * sideways when the window is narrower than four panes); phones switch between them with tabs and scroll the page.
 */
export default function Workspace({ panes }: { panes: P[] }) {
  const [tab, setTab] = useState(panes[0].key);
  return (
    <div className="flex flex-col md:h-full md:min-h-0">
      <div role="tablist" aria-label="Panels" className="md:hidden sticky top-0 z-10 shrink-0 flex gap-1 overflow-x-auto px-2 py-2 border-b border-line bg-panel">
        {panes.map((p) => (
          <button key={p.key} role="tab" aria-selected={tab === p.key} onClick={() => setTab(p.key)} className={`h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap ${tab === p.key ? "bg-fg text-bg" : "bg-raised text-muted"}`}>
            {p.title}
          </button>
        ))}
      </div>
      <div className="flex md:flex-1 md:min-h-0 md:overflow-x-auto bg-line gap-px">
        {panes.map((p) => (
          <div key={p.key} className={`${tab === p.key ? "flex" : "hidden"} md:flex flex-col flex-1 min-w-0 md:min-w-[330px]`}>
            {p.node}
          </div>
        ))}
      </div>
    </div>
  );
}
