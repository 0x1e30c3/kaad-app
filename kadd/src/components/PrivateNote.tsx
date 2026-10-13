"use client";
import { useState } from "react";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { loadNotes, NOTE_MAX, saveNotes, type Notes } from "@/lib/notes";
import { openLogin, requireAccount, toast, useStore } from "@/lib/store";
import { passkeyError } from "@/lib/wallet";
import { isMeraError } from "@category-labs/mera";
import { card } from "./ui";

// Decrypted notes stay in memory for this tab only, so moving between wallets doesn't ask for the passkey again.
let unlocked: { owner: string; notes: Notes } | null = null;

const fail = (e: unknown) => (isMeraError(e) ? passkeyError(e) : e instanceof Error ? e.message : "Something went wrong");

/**
 * Your private note on a wallet: encrypted in the browser with a key derived from your passkey (its own PRF salt,
 * separate from your account key). Kadd stores only ciphertext; the same passkey on another device opens it.
 */
export default function PrivateNote({ wallet }: { wallet: string }) {
  const { user } = useStore();
  const mine = user && unlocked?.owner === user.address ? unlocked.notes : null;
  const [notes, setNotes] = useState<Notes | null>(mine);
  const [text, setText] = useState(mine?.[wallet]?.text ?? "");
  const [busy, setBusy] = useState<"unlock" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user)
    return (
      <section className={`${card} p-5 flex flex-wrap items-center gap-3`}>
        <Lock className="size-4 text-muted" />
        <p className="flex-1 min-w-[200px] text-[13px] text-muted">Keep a private note on this wallet, encrypted to your passkey.</p>
        <button onClick={() => openLogin()} className="h-8 px-3.5 rounded-lg bg-brand-fill text-[#0a0a0a] text-[12px] font-semibold hover:brightness-95">Sign in</button>
      </section>
    );

  const unlock = async () => {
    setBusy("unlock");
    setError(null);
    try {
      const n = await loadNotes(user.address);
      unlocked = { owner: user.address, notes: n };
      setNotes(n);
      setText(n[wallet]?.text ?? "");
    } catch (e) {
      setError(fail(e));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!notes) return;
    setBusy("save");
    setError(null);
    try {
      const address = await requireAccount(); // the write is signed by your account's session
      if (!address) return;
      const next = { ...notes };
      if (text.trim()) next[wallet] = { text: text.trim(), at: Date.now() };
      else delete next[wallet];
      await saveNotes(address, user.credentialId, next);
      unlocked = { owner: address, notes: next };
      setNotes(next);
      toast("Note saved, encrypted to your passkey");
    } catch (e) {
      setError(fail(e));
    } finally {
      setBusy(null);
    }
  };

  const saved = notes?.[wallet];
  const dirty = notes !== null && text.trim() !== (saved?.text ?? "");
  const count = notes ? Object.keys(notes).length : 0;

  return (
    <section className={`${card} p-5 flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="size-4 text-muted" />
        <h2 className="text-[14px] font-semibold">Your private note</h2>
        <span className="text-[11px] text-muted">Encrypted to your passkey · only you can read it, on any device it syncs to</span>
      </div>

      {notes === null ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 min-w-[220px] text-[13px] text-muted">
            Notes are encrypted in your browser with a key your passkey derives just for them (its own salt, separate from your wallet key). Kadd only stores the ciphertext.
          </p>
          <button onClick={unlock} disabled={busy !== null} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-fill text-[#0a0a0a] text-[13px] font-semibold hover:brightness-95 disabled:opacity-60">
            {busy === "unlock" ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />} Unlock notes
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))}
            rows={3}
            placeholder="Why you're watching this wallet, what it tends to buy, when you'd stop copying it…"
            aria-label="Private note on this wallet"
            className="w-full resize-y rounded-lg bg-raised border border-line px-3 py-2.5 text-[13px] outline-none focus:border-line-strong placeholder:text-faint"
          />
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
            <span className="tabular-nums">{text.length}/{NOTE_MAX}</span>
            <span suppressHydrationWarning>{saved ? `Saved ${new Date(saved.at).toLocaleString()}` : "Not saved yet"}</span>
            <span>· {count} {count === 1 ? "note" : "notes"} in your vault</span>
            <button onClick={save} disabled={!dirty || busy !== null} className="ml-auto inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-brand-fill text-[#0a0a0a] text-[12px] font-semibold hover:brightness-95 disabled:opacity-50">
              {busy === "save" && <Loader2 className="size-3.5 animate-spin" />} Save note
            </button>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-[12px] text-down">{error}</p>}
    </section>
  );
}
