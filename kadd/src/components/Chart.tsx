"use client";
import { useEffect, useRef } from "react";
import { CandlestickSeries, HistogramSeries, createChart, type UTCTimestamp } from "lightweight-charts";
import { usd, type Candle } from "@/lib/mock";

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export default function Chart({ data }: { data: Candle[] }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chart = createChart(el.current!, {
      autoSize: true,
      localization: { priceFormatter: usd },
      layout: { background: { color: "transparent" }, fontSize: 11, attributionLogo: false },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      crosshair: { mode: 1 },
    });
    const candles = chart.addSeries(CandlestickSeries, { borderVisible: false });
    candles.setData(data.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
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
      vol.setData(data.map((c) => ({ time: c.time as UTCTimestamp, value: c.value, color: (c.close >= c.open ? up : down) + "55" })));
    };
    paint();
    const obs = new MutationObserver(paint);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    chart.timeScale().fitContent();
    return () => {
      obs.disconnect();
      chart.remove();
    };
  }, [data]);

  return <div ref={el} className="w-full h-full" />;
}
