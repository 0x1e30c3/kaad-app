"use client";
import { useEffect, useState } from "react";
import { formatGwei } from "viem";
import { chain, publicClient } from "@/lib/wallet";

type Status = { block: bigint; gas: bigint; ms: number } | "down" | null;

/** Live network status, polled from the same RPC the app uses for transactions. */
export default function StatusBar() {
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    let live = true;
    const poll = async () => {
      const t0 = performance.now();
      try {
        const [block, gas] = await Promise.all([publicClient.getBlockNumber({ cacheTime: 0 }), publicClient.getGasPrice()]);
        if (live) setStatus({ block, gas, ms: Math.round(performance.now() - t0) });
      } catch {
        if (live) setStatus("down");
      }
    };
    poll();
    const id = setInterval(poll, 5_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  const ok = status !== null && status !== "down";
  return (
    <footer className="hidden md:flex h-7 shrink-0 items-center gap-4 px-3 border-t border-line bg-panel text-[11px] text-muted tabular-nums">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-[#836ef9]" /> {chain.name}
      </span>
      {ok && (
        <>
          <span>Block <b className="text-fg font-medium">#{status.block.toLocaleString("en-US")}</b></span>
          <span>Gas <b className="text-fg font-medium">{Number(formatGwei(status.gas)).toFixed(0)} gwei</b></span>
        </>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${ok ? "bg-up" : status === "down" ? "bg-down" : "bg-faint"}`} />
        {ok ? `Connected · ${status.ms}ms` : status === "down" ? "RPC disconnected" : "Connecting…"}
      </span>
    </footer>
  );
}
