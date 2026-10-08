"use client";
import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { REFERRALS_READY, inviteLink } from "@/lib/referral";
import { btnSm } from "./ui";

/** Share a Kadd page: native share sheet where there is one, else copy the link; plus a prefilled post on X. Signed
 * in, the link carries ?ref= so whoever signs up through it counts as your invite. */
export default function ShareButton({ path, text }: { path: string; text: string }) {
  const { user } = useStore();
  const [copied, setCopied] = useState(false);
  const url = () => (user && REFERRALS_READY ? inviteLink(user.address, path) : new URL(path, location.origin).toString());
  return (
    <span className="inline-flex gap-1.5">
      <button
        onClick={async () => {
          if (navigator.share) return navigator.share({ title: "Kadd", text, url: url() }).catch(() => {});
          await navigator.clipboard?.writeText(url());
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className={btnSm}
      >
        {copied ? <Check className="size-3.5 text-up" /> : <Share2 className="size-3.5" />}
        {copied ? "Link copied" : "Share"}
      </button>
      <button onClick={() => open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url())}`, "_blank", "noopener")} className={btnSm}>
        Post on X
      </button>
    </span>
  );
}
