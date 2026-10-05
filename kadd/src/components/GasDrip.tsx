"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { requestGas, useWallet } from "@/lib/swap";

/** New account with no MON? Ask the gas drip once per browser session, so the first trade just works. */
export default function GasDrip() {
  const { user } = useStore();
  const wallet = useWallet();
  useEffect(() => {
    if (!user || !wallet || wallet.mon >= 0.05) return;
    const flag = `kadd:gas:${user.address}`;
    try {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
    } catch {}
    void requestGas(user.address, true);
  }, [user, wallet]);
  return null;
}
