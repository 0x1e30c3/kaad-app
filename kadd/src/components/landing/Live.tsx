"use client";
import { useEffect, useState } from "react";
import { publicClient } from "@/lib/wallet";

/** Live Jakarta clock + latest Monad testnet block (Verteal's studio clocks, Monad flavour). */
export default function Live({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  const [block, setBlock] = useState<bigint | null>(null);

  useEffect(() => {
    let live = true;
    const tick = () => setNow(new Date());
    const poll = () => publicClient.getBlockNumber({ cacheTime: 0 }).then((b) => live && setBlock(b), () => {});
    tick();
    poll();
    const a = setInterval(tick, 1000);
    const b = setInterval(poll, 4000);
    return () => {
      live = false;
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  const time = now?.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
  const blockText = block ? `#${block.toLocaleString("en-US")}` : "Connecting…";

  if (compact)
    return (
      <div className="flex items-center gap-6 text-[14px] tabular-nums">
        <span>
          Jakarta, Indonesia <span className="ml-1.5 font-semibold">{time ?? "–"}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${block ? "bg-[#2ccf7f] animate-pulse" : "bg-faint"}`} />
          Monad block <span className="font-semibold">{blockText}</span>
        </span>
      </div>
    );

  return (
    <div className="grid grid-cols-2 gap-x-12 gap-y-4 tabular-nums">
      <div>
        <div className="text-[13px] text-muted">Jakarta · WIB</div>
        <div className="text-[28px] font-medium tracking-[-0.02em]">{time ?? "–"}</div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-[13px] text-muted">
          <span className={`size-1.5 rounded-full ${block ? "bg-[#2ccf7f] animate-pulse" : "bg-faint"}`} /> Monad testnet
        </div>
        <div className="text-[28px] font-medium tracking-[-0.02em]">{blockText}</div>
      </div>
    </div>
  );
}
