"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Candle } from "@/lib/mock";
import Chart from "./Chart";

const TFS = ["auto", "1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Tf = (typeof TFS)[number];
const LABEL: Record<Tf, string> = { auto: "Auto", "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1D" };
const REFRESH: Record<Tf, number> = { auto: 30, "1m": 15, "5m": 30, "15m": 60, "1h": 120, "4h": 300, "1d": 600 };
type Data = { tf: Exclude<Tf, "auto">; candles: Candle[]; trades: number; source: string };

const fetchChart = async (pool: string, token: string, tf: Tf): Promise<Data> => {
  const r = await fetch(`/api/chart?pool=${pool}&token=${token}&tf=${tf}`);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

/**
 * The token page chart: loads on its own (the page never waits for it), timeframe switcher with an Auto mode that
 * picks a readable timeframe for quiet tokens, and Price / Market cap views of the same candles.
 */
export default function TokenChart({ pool, token, supply }: { pool: string; token: string; supply: number }) {
  const [tf, setTf] = useState<Tf>("auto");
  const [mode, setMode] = useState<"mc" | "price">("mc");
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    const run = () =>
      fetchChart(pool, token, tf).then(
        (d) => {
          if (!live) return;
          setData(d);
          setState("ok");
        },
        () => live && setState((s) => (s === "ok" ? "ok" : "error")), // keep the last chart on a failed refresh
      );
    run();
    const id = setInterval(run, REFRESH[tf] * 1000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [pool, token, tf, retry]);

  const scale = mode === "mc" && supply > 0 ? supply : 1;
  const candles = data?.candles.map((c) => ({ ...c, open: c.open * scale, high: c.high * scale, low: c.low * scale, close: c.close * scale })) ?? [];
  const seg = (on: boolean) => `min-h-11 md:min-h-6 px-2 rounded text-[12px] font-medium tabular-nums ${on ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`;

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-2 pb-1.5">
        <div role="group" aria-label="Timeframe" className="flex flex-wrap p-0.5 rounded-md bg-raised">
          {TFS.map((t) => (
            <button key={t} aria-pressed={tf === t} onClick={() => { if (t !== tf) { setTf(t); setState("loading"); } }} className={seg(tf === t)}>
              {t === "auto" && tf === "auto" && data ? `Auto · ${LABEL[data.tf]}` : LABEL[t]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Chart value" className="flex flex-wrap p-0.5 rounded-md bg-raised">
          <button aria-pressed={mode === "mc"} onClick={() => setMode("mc")} className={seg(mode === "mc")}>MCap</button>
          <button aria-pressed={mode === "price"} onClick={() => setMode("price")} className={seg(mode === "price")}>Price</button>
        </div>
        {state === "loading" && data && <Loader2 className="size-3.5 animate-spin text-muted" />}
        {data && (
          <span className="ml-auto text-[11px] text-faint">
            {data.trades < 5 ? "Barely traded: " : ""}
            {data.trades} {data.trades === 1 ? "candle" : "candles"} with trades{data.source === "chain" ? " · from chain" : ""}
          </span>
        )}
      </div>
      <div className="relative flex-1 min-h-0">
        {state === "loading" && !data ? (
          <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">
            <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading chart…</span>
          </div>
        ) : state === "error" && !data ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-[13px] text-muted">
            <div className="flex flex-col items-center gap-2">
              Chart data is briefly unavailable.
              <button onClick={() => { setState("loading"); setRetry((n) => n + 1); }} className="min-h-11 md:min-h-8 px-3 rounded-lg border border-line-strong text-[12px] font-semibold text-fg hover:bg-hover">Try again</button>
            </div>
          </div>
        ) : !candles.length ? (
          <p className="absolute inset-0 grid place-items-center text-[13px] text-muted">No trades in this window. Try a longer timeframe.</p>
        ) : (
          <Chart key={`${data?.tf}-${mode}`} data={candles} price={mode === "price"} />
        )}
      </div>
    </div>
  );
}
