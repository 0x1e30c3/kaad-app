"use client";
import { useEffect, useState } from "react";
import type { Quote } from "./market";

/** Live quotes for a set of token addresses, refreshed every 30s. Missing entries mean "not loaded yet". */
export function useQuotes(addresses: string[]) {
  const key = [...new Set(addresses.map((a) => a.toLowerCase()))].sort().join(",");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  useEffect(() => {
    if (!key) return;
    let live = true;
    const load = () =>
      fetch(`/api/quotes?a=${key}`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((q) => live && setQuotes((prev) => ({ ...prev, ...q })), () => {});
    load();
    const id = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [key]);
  return quotes;
}
