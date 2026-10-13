"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the server component's data every `seconds` while the tab is visible. */
export default function AutoRefresh({ seconds = 30, paused = false }: { seconds?: number; paused?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => document.visibilityState === "visible" && !document.querySelector("dialog[open]") && router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds, paused]);
  return null;
}
