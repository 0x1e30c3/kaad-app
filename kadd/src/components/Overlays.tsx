"use client";
import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Fingerprint, KeyRound, Loader2, X } from "lucide-react";
import { login, openLogin, useStore } from "@/lib/store";
import { createAccount, passkeyError, unlock } from "@/lib/wallet";

function LoginModal() {
  const { loginOpen, user } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState<null | "new" | "existing">(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const d = ref.current!;
    if (loginOpen && !d.open) d.showModal();
    if (!loginOpen && d.open) d.close();
  }, [loginOpen]);

  const run = async (kind: "new" | "existing") => {
    setBusy(kind);
    setError("");
    try {
      const res = kind === "new" ? await createAccount() : await unlock(user?.credentialId);
      login(res.address, res.credentialId);
    } catch (e) {
      setError(passkeyError(e));
    } finally {
      setBusy(null);
    }
  };

  const returning = !!user; // logged in before, session locked after a reload

  return (
    <dialog
      ref={ref}
      onClose={() => (openLogin(false), setError(""))}
      onClick={(e) => e.target === ref.current && openLogin(false)}
      className="m-auto w-[min(400px,calc(100vw-32px))] rounded-xl border border-line bg-panel text-fg p-0 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div className="grid place-items-center size-11 rounded-xl bg-raised">
            <Fingerprint className="size-6" />
          </div>
          <button onClick={() => openLogin(false)} aria-label="Close" className="grid place-items-center size-8 rounded-md text-muted hover:text-fg hover:bg-hover">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{returning ? "Unlock your account" : "Sign in to Kadd"}</h2>
          <p className="text-muted text-[13px] leading-relaxed">
            Just use Face ID, fingerprint, or your device PIN. No seed phrase, no wallet install.
          </p>
        </div>
        {!returning && (
          <ul className="flex flex-col gap-2 text-[12px] text-muted">
            {["Your account comes from your passkey. No keys are stored on a server", "Recover it on any device with the same passkey", "Trade without repeat confirmations while the session is active"].map((s) => (
              <li key={s} className="flex gap-2">
                <CircleCheck className="size-3.5 mt-px text-up shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="flex gap-2 p-3 rounded-lg bg-down/10 text-down text-[12px]">
            <CircleAlert className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            autoFocus
            onClick={() => run(returning ? "existing" : "new")}
            disabled={!!busy}
            className="h-11 rounded-lg bg-fg text-bg font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-70"
          >
            {busy === (returning ? "existing" : "new") ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
            {returning ? "Unlock with passkey" : "Create account with passkey"}
          </button>
          <button
            onClick={() => run(returning ? "new" : "existing")}
            disabled={!!busy}
            className="h-11 rounded-lg border border-line-strong font-semibold inline-flex items-center justify-center gap-2 hover:bg-hover disabled:opacity-70"
          >
            {busy === (returning ? "new" : "existing") ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {returning ? "Use a new account" : "I already have a Kadd passkey"}
          </button>
        </div>
        <p className="text-[11px] text-faint text-center">Your account lives on Monad testnet. Swaps and Clubs are real testnet transactions with free test USDC.</p>
      </div>
    </dialog>
  );
}

function Toasts() {
  const { toasts } = useStore();
  return (
    <div aria-live="polite" className="fixed z-50 left-1/2 -translate-x-1/2 bottom-[calc(var(--bottom-safe-offset)+var(--bottom-action-height)+var(--bottom-gap)*2)] lg:bottom-[max(40px,var(--safe-area-bottom))] w-[calc(100%-24px)] max-w-lg flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-center gap-2 min-h-10 py-2 px-4 break-words max-w-full rounded-lg bg-fg text-bg text-[13px] font-medium shadow-xl">
          {t.tone === "ok" ? <CircleCheck className="size-4 shrink-0 text-up" /> : <CircleAlert className="size-4 shrink-0 text-down" />}
          <span className="min-w-0 [overflow-wrap:anywhere]">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

export default function Overlays() {
  return (
    <>
      <LoginModal />
      <Toasts />
    </>
  );
}
