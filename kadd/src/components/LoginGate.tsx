"use client";
import { Fingerprint, type LucideIcon } from "lucide-react";
import { openLogin } from "@/lib/store";

export default function LoginGate({ icon: Icon = Fingerprint, title, desc }: { icon?: LucideIcon; title: string; desc: string }) {
  return (
    <div className="grid place-items-center text-center gap-3 py-20 px-6 rounded-lg border border-dashed border-line-strong">
      <div className="grid place-items-center size-12 rounded-xl bg-raised">
        <Icon className="size-6 text-muted" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-[15px]">{title}</p>
        <p className="max-w-sm text-muted">{desc}</p>
      </div>
      <button onClick={() => openLogin()} className="h-9 px-4 rounded-md bg-fg text-bg font-semibold hover:opacity-90">
        Sign in with passkey
      </button>
    </div>
  );
}
