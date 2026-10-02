"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { short } from "@/lib/mock";

export default function CopyAddress({ address }: { address: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard?.writeText(address);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      title="Copy contract address"
      className="inline-flex items-center gap-1 font-mono text-[11px] text-faint hover:text-fg"
    >
      {short(address)}
      {done ? <Check className="size-3 text-up" /> : <Copy className="size-3" />}
    </button>
  );
}
