"use client";
import { useSyncExternalStore } from "react";
const KEY = "kadd.practiceOneClick";
const EVENT = "kadd:practice-one-click";
export function practiceOneClick() {
  try { return sessionStorage.getItem(KEY) === "true"; } catch { return false; }
}
export function setPracticeOneClick(enabled: boolean) {
  try { sessionStorage.setItem(KEY, String(enabled)); } catch { /* Keep review enabled if storage is unavailable. */ }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(EVENT, notify); window.removeEventListener("storage", notify); };
}
export function usePracticeOneClick() {
  return useSyncExternalStore(subscribe, practiceOneClick, () => false);
}
