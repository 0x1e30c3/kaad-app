"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the server component's data every `seconds` while the tab is visible. */
export default function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
