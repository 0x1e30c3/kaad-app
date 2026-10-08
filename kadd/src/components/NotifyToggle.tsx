"use client";
import { useState, useSyncExternalStore } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "@/lib/store";
import { btnSm } from "./ui";

const noop = () => () => {};
const permission = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

/** Asks for browser notifications, used by ActivityWatcher for followed-wallet trades and auto copies. */
export default function NotifyToggle() {
  const [, rerender] = useState(0);
  const p = useSyncExternalStore(noop, permission, () => "default");
  if (p === "unsupported") return null;
  if (p === "granted") return <span className="inline-flex items-center gap-1 text-[12px] text-up"><BellRing className="size-3.5" /> Notifications on</span>;
  if (p === "denied") return <span className="inline-flex items-center gap-1 text-[12px] text-muted" title="Allow notifications for this site in your browser settings"><BellOff className="size-3.5" /> Notifications blocked</span>;
  return (
    <button
      onClick={async () => {
        const r = await Notification.requestPermission();
        rerender((n) => n + 1);
        toast(r === "granted" ? "You'll be notified while Kadd is open" : "Notifications not allowed", r === "granted" ? "ok" : "err");
      }}
      className={btnSm}
    >
      <Bell className="size-3.5" /> Notify me
    </button>
  );
}
