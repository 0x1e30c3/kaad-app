"use client";
import { useEffect, useRef } from "react";
import { CandlestickSeries, HistogramSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { usd, type Candle } from "@/lib/mock";

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const VISIBLE = 120; // candles in view at first; scroll/zoom for the rest

/** Tiny prices need significant digits ($0.00009214), not "$0". */
const priceFmt = (n: number) => "$" + (n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toLocaleString("en-US", { maximumSignificantDigits: 4 }));

/**
 * Candlesticks + volume. The chart is created once (remount with a new `key` to change units); later `data` updates
 * only replace the series data, so periodic refreshes don't flicker or reset the user's zoom.
 */
export default function Chart({ data, price = false }: { data: Candle[]; price?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<{ chart: IChartApi; candles: ISeriesApi<"Candlestick">; vol: ISeriesApi<"Histogram">; paint: () => void } | null>(null);
  const latest = useRef(data); // initial data for the create effect; the update effect keeps it current

  useEffect(() => {
    const chart = createChart(el.current!, {
      autoSize: true,
      localization: { priceFormatter: price ? priceFmt : usd },
      layout: { background: { color: "transparent" }, fontSize: 11, attributionLogo: false },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, rightOffset: 4 },
      crosshair: { mode: 1 },
    });
    const candles = chart.addSeries(CandlestickSeries, { borderVisible: false, priceFormat: { type: "custom", formatter: price ? priceFmt : usd, minMove: 1e-12 } });
    const vol = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // Re-read the theme tokens whenever light/dark flips.
    const paint = () => {
      const up = css("--up"), down = css("--down"), grid = css("--chart-grid");
      chart.applyOptions({
        layout: { textColor: css("--muted"), fontFamily: css("--font-inter") },
        grid: { vertLines: { color: grid }, horzLines: { color: grid } },
        crosshair: { vertLine: { labelBackgroundColor: css("--fg") }, horzLine: { labelBackgroundColor: css("--fg") } },
      });
      candles.applyOptions({ upColor: up, downColor: down, wickUpColor: up, wickDownColor: down });
      vol.setData(latest.current.map((c) => ({ time: c.time as UTCTimestamp, value: c.value, color: (c.close >= c.open ? up : down) + "55" })));
    };
    api.current = { chart, candles, vol, paint };
    candles.setData(latest.current.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
    paint();
    const n = latest.current.length;
    if (n > VISIBLE) chart.timeScale().setVisibleLogicalRange({ from: n - VISIBLE, to: n + 4 });
    else chart.timeScale().fitContent();
    const obs = new MutationObserver(paint);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      obs.disconnect();
      chart.remove();
      api.current = null;
    };
  }, [price]);

  // Later refreshes: swap the data in place.
  useEffect(() => {
    latest.current = data;
    const a = api.current;
    if (!a) return;
    a.candles.setData(data.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
    a.paint();
  }, [data]);

  return <div ref={el} className="w-full h-full" />;
}
