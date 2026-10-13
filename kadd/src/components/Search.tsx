"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search as SearchIcon } from "lucide-react";
import { usd, short } from "@/lib/mock";
import { isAddress, type MarketToken } from "@/lib/market";
import { RiskBadge, TokenIcon } from "./ui";

export default function Search() {
  const router = useRouter();
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [mobile, setMobile] = useState(false); // full-width search overlay on small screens
  const [res, setRes] = useState<{ q: string; tokens: MarketToken[] | null; failed?: boolean }>({ q: "", tokens: null });

  const s = q.trim();
  const direct = isAddress(s) ? s.toLowerCase() : null; // a pasted contract address opens directly
  const tokens = res.q === s ? res.tokens : null;
  const loading = open && tokens === null;
  const results = [...(direct ? [{ address: direct } as MarketToken] : []), ...(tokens ?? []).filter((t) => t.address !== direct)];

  const activeIndex = Math.max(0, Math.min(i, results.length - 1));

  // Debounced lookup while the box is open; empty query shows what's hot.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(s)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((tokens: MarketToken[]) => live && setRes({ q: s, tokens }), () => live && setRes({ q: s, tokens: [], failed: true }));
    }, s ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [s, open]);

  // "/" focuses search unless the user is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (address: string) => {
    setOpen(false);
    setMobile(false);
    setQ("");
    input.current?.blur();
    router.push(`/token/${address}`);
  };

  return (
    <>
      <button
        ref={trigger}
        onClick={() => (setMobile(true), setTimeout(() => input.current?.focus()))}
        aria-label="Search tokens"
        className="sm:hidden grid place-items-center size-11 rounded-md text-muted hover:text-fg hover:bg-hover"
      >
        <SearchIcon className="size-4" />
      </button>
      <div className={`${mobile ? "fixed inset-x-2 top-2 z-40 block" : "hidden"} min-w-0 sm:relative sm:inset-auto sm:top-auto sm:block sm:w-[clamp(8rem,20vw,16rem)] sm:shrink`}>
        <label className="flex items-center gap-2 w-full h-10 sm:h-8 px-2.5 shadow-lg sm:shadow-none rounded-md bg-raised border border-transparent focus-within:ring-2 focus-within:ring-fg text-muted">
          <SearchIcon className="size-3.5 shrink-0" />
          <input
            ref={input}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            value={q}
            onChange={(e) => (setQ(e.target.value), setI(0), setOpen(true))}
            onFocus={() => setOpen(true)}
            onBlur={() => { setOpen(false); setMobile(false); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setOpen(true);
                if (results.length) setI(open ? (activeIndex + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : e.key === "ArrowDown" ? 0 : results.length - 1);
              }
              if (e.key === "Enter" && open && results[activeIndex]) {
                e.preventDefault();
                go(results[activeIndex].address);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                setMobile(false);
                if (mobile) trigger.current?.focus();
              }
            }}
            placeholder="Search token or contract address"
            aria-label="Search tokens"
            className="flex-1 min-w-0 bg-transparent outline-none text-fg placeholder:text-faint"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-line text-faint">/</kbd>
        </label>

        {open && (
          <div className="absolute z-30 top-12 sm:top-10 inset-x-0 sm:left-auto sm:w-96 rounded-lg border border-line bg-panel shadow-2xl overflow-hidden">
            <p role="status" className="px-3 pt-2.5 pb-1 text-[11px] text-faint">{loading ? "Searching…" : s ? `${results.length} results` : "Hot right now"}</p>
            {!loading && results.length === 0 && <p className="px-3 pb-3 text-muted">{res.failed ? "Search is unavailable right now. Try again in a moment." : "No tokens found on Monad."}</p>}
            <div id={listId} role="listbox" aria-label="Tokens" aria-busy={loading}>
              {results.map((t, idx) => (
                <button
                  key={t.address}
                  id={`${listId}-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(t.address)}
                  onMouseEnter={() => setI(idx)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${idx === activeIndex ? "bg-hover" : ""}`}
                >
                  {t.symbol ? (
                    <>
                      <TokenIcon t={t} size={28} />
                      <span className="flex-1 min-w-0 truncate">
                        <b>{t.symbol}</b> <span className="text-muted">{t.name}</span>
                      </span>
                      <span className="tabular-nums">{usd(t.mc)}</span>
                      <RiskBadge risk={t.risk} compact />
                    </>
                  ) : (
                    <>
                      <ArrowRight className="size-4 text-muted" />
                      <span className="flex-1">Open token <span className="font-mono">{short(t.address)}</span></span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
