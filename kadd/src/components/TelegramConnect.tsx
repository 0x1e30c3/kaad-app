"use client";
import { Send } from "lucide-react";
import { toast, useStore } from "@/lib/store";
import { TELEGRAM_BOT, linkTelegram } from "@/lib/telegramLink";
import { btnSm } from "./ui";

/** Opens the Kadd bot linked to this browser's alerts, so they arrive with Kadd closed. */
export default function TelegramConnect() {
  const { following, user } = useStore();
  if (!TELEGRAM_BOT) return null;
  return (
    <button
      onClick={async () => {
        // Open the tab first (in the click) so popup blockers allow it, then point it at the bot link.
        const tab = window.open("", "_blank");
        try {
          const { url } = await linkTelegram(user?.address, following);
          if (tab) tab.location.href = url;
          else location.href = url;
        } catch (e) {
          tab?.close();
          toast((e as Error).message, "err");
        }
      }}
      className={btnSm}
    >
      <Send className="size-3.5" /> Alerts on Telegram
    </button>
  );
}
