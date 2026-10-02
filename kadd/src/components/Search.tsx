"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search as SearchIcon } from "lucide-react";
import { usd, short } from "@/lib/mock";
import { isAddress, type MarketToken } from "@/lib/market";
import { RiskBadge, TokenIcon } from "./ui";

export default function Search() {
  const router = useRouter();
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
        onClick={() => (setMobile(true), setTimeout(() => input.current?.focus()))}
        aria-label="Search tokens"
        className="sm:hidden grid place-items-center size-8 rounded-md text-muted hover:text-fg hover:bg-hover"
      >
        <SearchIcon className="size-4" />
      </button>
      <div className={`${mobile ? "fixed inset-x-2 top-2 z-40 block" : "hidden"} sm:relative sm:inset-auto sm:top-auto sm:block`}>
        <label className="flex items-center gap-2 w-full sm:w-56 xl:w-72 h-10 sm:h-8 px-2.5 shadow-lg sm:shadow-none rounded-md bg-raised border border-transparent focus-within:border-line-strong text-muted">
          <SearchIcon className="size-3.5 shrink-0" />
          <input
            ref={input}
            value={q}
            onChange={(e) => (setQ(e.target.value), setI(0), setOpen(true))}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => (setOpen(false), setMobile(false)), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setI(e.key === "ArrowDown" ? Math.min(i + 1, results.length - 1) : Math.max(i - 1, 0));
              }
              if (e.key === "Enter" && results[i]) go(results[i].address);
              if (e.key === "Escape") input.current?.blur();
            }}
            placeholder="Search token or contract address"
            aria-label="Search tokens"
            className="flex-1 min-w-0 bg-transparent outline-none text-fg placeholder:text-faint"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-line text-faint">/</kbd>
        </label>

        {open && (
          <div className="absolute z-30 top-12 sm:top-10 inset-x-0 sm:left-auto sm:w-96 rounded-lg border border-line bg-panel shadow-2xl overflow-hidden">
            <p className="px-3 pt-2.5 pb-1 text-[11px] text-faint">{loading ? "Searching…" : s ? `${results.length} results` : "Hot right now"}</p>
            {!loading && results.length === 0 && <p className="px-3 pb-3 text-muted">{res.failed ? "Search is unavailable right now. Try again in a moment." : "No tokens found on Monad."}</p>}
            {results.map((t, idx) => (
              <button
                key={t.address}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(t.address)}
                onMouseEnter={() => setI(idx)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${idx === i ? "bg-hover" : ""}`}
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
        )}
      </div>
    </>
  );
}
