"use client";
import { useEffect } from "react";
import { toast, useStore } from "@/lib/store";
import { KIND_LABEL, STRATEGIES_READY, executeStrategy, strategiesOf } from "@/lib/strategies";
import { isUnlocked } from "@/lib/wallet";

/**
 * While the app is open and your session is unlocked, fills your strategies the moment their condition holds.
 * ponytail: client-side keeper (your wallet pays the gas, only while a tab is open); a server cron keeper can call
 * the same public execute() for everyone later.
 */
export default function StrategyKeeper() {
  const { user } = useStore();
  useEffect(() => {
    if (!user || !STRATEGIES_READY) return;
    let running = false;
    const tick = async () => {
      if (running || !isUnlocked() || document.visibilityState !== "visible") return;
      running = true;
      try {
        for (const s of await strategiesOf(user.address)) {
          if (!s.ready || s.done) continue;
          await executeStrategy(s.id);
          toast(`${KIND_LABEL[s.kind]} filled: ${s.market.symbol}`);
        }
      } catch {
        // Someone else filled it first, or the price moved back: try again next tick.
      } finally {
        running = false;
      }
    };
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [user]);
  return null;
}
