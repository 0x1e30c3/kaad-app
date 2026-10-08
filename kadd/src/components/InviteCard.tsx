"use client";
import { useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { REFERRALS_READY, inviteLink } from "@/lib/referral";
import { useAsync } from "@/lib/useAsync";
import { btnSm, card } from "./ui";

/** My invite link and how many people it brought in (counted onchain). Hidden until KaddReferrals is deployed. */
export default function InviteCard() {
  const { user } = useStore();
  const me = user?.address;
  const [copied, setCopied] = useState(false);
  const { data } = useAsync(() => (me ? fetch(`/api/referrals?ref=${me}`).then((r) => r.json() as Promise<{ invited: number; active: number }>) : Promise.resolve(null)), [me]);
  if (!REFERRALS_READY || !me) return null;
  return (
    <div className={`${card} p-4 flex-row flex-wrap items-center gap-3`}>
      <UserPlus className="size-5 text-muted" />
      <div className="flex-1 min-w-[200px]">
        <div className="text-[14px] font-semibold">Invite a friend</div>
        <div className="text-[12px] text-muted tabular-nums">
          {data ? `${data.invited} joined with your link · ${data.active} traded` : "Their first trade takes a minute, gas is on us."}
        </div>
      </div>
      <button
        onClick={async () => {
          await navigator.clipboard?.writeText(inviteLink(me));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className={btnSm}
      >
        {copied ? <Check className="size-3.5 text-up" /> : <Copy className="size-3.5" />} {copied ? "Link copied" : "Copy invite link"}
      </button>
    </div>
  );
}
