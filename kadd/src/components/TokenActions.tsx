"use client";
import { Share2, Star } from "lucide-react";
import type { TokenRef } from "@/lib/market";
import { isWatched, toast, toggleWatch, useStore } from "@/lib/store";

export default function TokenActions({ t }: { t: TokenRef }) {
  const on = isWatched(useStore(), t.address);
  const btn = "grid place-items-center size-7 rounded-md hover:bg-hover";

  const share = async () => {
    const url = location.href;
    if (navigator.share) return navigator.share({ title: `${t.symbol} on Kadd`, url }).catch(() => {});
    await navigator.clipboard?.writeText(url);
    toast("Token link copied");
  };

  return (
    <div className="flex gap-0.5 ml-1">
      <button onClick={() => toggleWatch(t)} aria-pressed={on} aria-label="Watchlist" className={`${btn} ${on ? "text-warn" : "text-muted hover:text-fg"}`}>
        <Star className={`size-4 ${on ? "fill-current" : ""}`} />
      </button>
      <button onClick={share} aria-label="Share" className={`${btn} text-muted hover:text-fg`}>
        <Share2 className="size-4" />
      </button>
    </div>
  );
}
