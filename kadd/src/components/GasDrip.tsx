"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { requestGas, useWallet } from "@/lib/swap";
import { captureRef, registerRef } from "@/lib/referral";

/**
 * New account with no MON? Ask the gas drip once per browser session, so the first trade just works. Once there's
 * gas, record who invited this account (if a ?ref= link brought it here).
 */
export default function GasDrip() {
  const { user } = useStore();
  const wallet = useWallet();
  useEffect(captureRef, []);
  const hasGas = (wallet?.mon ?? 0) >= 0.01;
  useEffect(() => {
    if (user && hasGas) void registerRef(user.address);
  }, [user, hasGas]);
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
