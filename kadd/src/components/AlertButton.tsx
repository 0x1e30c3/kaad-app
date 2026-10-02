"use client";
import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import type { TokenRef } from "@/lib/market";
import { addAlert, removeAlert, useStore } from "@/lib/store";

/** Bell next to a token: set "tell me when the price goes above / below X". */
export default function AlertButton({ t, price }: { t: TokenRef; price: number }) {
  const { alerts } = useStore();
  const mine = alerts.filter((a) => a.address === t.address);
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(true);
  const [value, setValue] = useState("");
  const target = parseFloat(value);
  const preset = (pct: number) => setValue(String(Number((price * (1 + pct / 100)).toPrecision(4))));

  const save = async () => {
    if (!(target > 0)) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission().catch(() => {});
    addAlert(t, above, target);
    setOpen(false);
    setValue("");
  };

  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button
        onClick={() => (setOpen(!open), !value && preset(above ? 20 : -20))}
        aria-label="Price alert"
        aria-expanded={open}
        className={`grid place-items-center size-7 rounded-md hover:bg-hover ${mine.length ? "text-warn" : "text-muted hover:text-fg"}`}
      >
        {mine.length ? <BellRing className="size-4" /> : <Bell className="size-4" />}
      </button>
      {open && (
        <div className="absolute z-30 left-0 top-9 w-72 rounded-lg border border-line bg-panel shadow-2xl p-3 flex flex-col gap-2.5 text-[12px]">
          <div className="font-semibold text-[13px]">Price alert for {t.symbol}</div>
          <div className="text-muted">Now ${price.toLocaleString("en-US", { maximumSignificantDigits: 4 })}</div>
          <div className="grid grid-cols-2 p-0.5 rounded-md bg-raised font-semibold">
            {[true, false].map((b) => (
              <button key={String(b)} onClick={() => (setAbove(b), preset(b ? 20 : -20))} className={`h-7 rounded ${above === b ? `bg-panel shadow-sm ${b ? "text-up" : "text-down"}` : "text-muted"}`}>
                {b ? "Goes above" : "Drops below"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 h-9 px-2.5 rounded-md bg-raised">
            <span className="text-muted">$</span>
            <input autoFocus value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="Alert price" className="flex-1 min-w-0 bg-transparent outline-none font-semibold tabular-nums" />
          </label>
          <div className="flex gap-1">
            {(above ? [10, 25, 50, 100] : [-10, -25, -50, -75]).map((p) => (
              <button key={p} onClick={() => preset(p)} className="flex-1 h-7 rounded-md border border-line text-muted hover:text-fg tabular-nums">{p > 0 ? "+" : ""}{p}%</button>
            ))}
          </div>
          <button onClick={save} disabled={!(target > 0)} className="h-8 rounded-md bg-fg text-bg font-semibold disabled:opacity-40">Set alert</button>
          {mine.length > 0 && (
            <ul className="border-t border-line pt-2 flex flex-col gap-1">
              {mine.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span>{a.above ? "Above" : "Below"} ${a.price.toLocaleString("en-US", { maximumSignificantDigits: 4 })}</span>
                  <button onClick={() => removeAlert(a.id)} className="text-muted hover:text-down">Remove</button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-faint text-[11px]">Checked every 30s while Kadd is open; you’ll get a browser notification if allowed.</p>
        </div>
      )}
    </div>
  );
}
