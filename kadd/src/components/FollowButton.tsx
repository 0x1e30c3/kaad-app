"use client";
import { Star } from "lucide-react";
import { toggleFollow, useStore } from "@/lib/store";

export default function FollowButton({ address }: { address: string }) {
  const on = useStore().following.includes(address.toLowerCase());
  return (
    <button
      onClick={() => toggleFollow(address)}
      aria-pressed={on}
      className={`h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold ${on ? "border border-line-strong hover:bg-hover" : "bg-fg text-bg hover:opacity-90"}`}
    >
      <Star className={`size-4 ${on ? "fill-current text-warn" : ""}`} /> {on ? "Following" : "Follow"}
    </button>
  );
}
