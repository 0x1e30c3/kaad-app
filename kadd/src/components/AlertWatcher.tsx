"use client";
import { useEffect } from "react";
import { removeAlert, toast, useStore } from "@/lib/store";
import { useQuotes } from "@/lib/useQuotes";

const fmt = (n: number) => "$" + n.toLocaleString("en-US", { maximumSignificantDigits: 4 });

/** Checks price alerts against live quotes (every 30s while the app is open) and fires each one once. */
export default function AlertWatcher() {
  const { alerts } = useStore();
  const quotes = useQuotes(alerts.map((a) => a.address));
  useEffect(() => {
    for (const a of alerts) {
      const price = quotes[a.address]?.price;
      if (!price || (a.above ? price < a.price : price > a.price)) continue;
      removeAlert(a.id);
      const msg = `${a.symbol} is ${a.above ? "above" : "below"} ${fmt(a.price)} (now ${fmt(price)})`;
      toast(msg);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Kadd price alert", { body: msg, icon: a.image ?? "/icon.png" });
    }
  }, [alerts, quotes]);
  return null;
}
