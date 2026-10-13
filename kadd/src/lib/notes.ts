"use client";
// Private notes on wallets, end-to-end encrypted to the user's passkey with a Mera secret vault.
//
// The vault's key comes from the same passkey as the account, but through its own random PRF salt (and Mera's
// "mera.v1.encrypt.secret" HKDF info), so it is unrelated to the signing key and to every other vault. Kadd's server
// only ever stores the ciphertext. Any device the passkey syncs to can decrypt it: sign in, unlock, same notes.
import { createSecretVaultWithExistingPasskey, decryptSecretVaultWithPasskey, parseSecretVault } from "@category-labs/mera";
import { notesMessage } from "./notesMessage";
import { walletClient } from "./wallet";

export type Notes = Record<string, { text: string; at: number }>; // wallet address → note
export const NOTE_MAX = 1000;

const rpId = () => location.hostname;

/** Fetches the encrypted vault and decrypts it (one passkey prompt). Empty when nothing was saved yet. */
export async function loadNotes(address: string): Promise<Notes> {
  const r = await fetch(`/api/notes?address=${address}`, { cache: "no-store" });
  const j = (await r.json()) as { ready: boolean; vault: string | null; error?: string };
  if (!r.ok || !j.ready) throw new Error(j.error ?? "Private notes are unavailable right now");
  if (!j.vault) return {};
  const bytes = await decryptSecretVaultWithPasskey({ rpId: rpId(), vault: parseSecretVault(j.vault) });
  return (JSON.parse(new TextDecoder().decode(bytes)) as { notes: Notes }).notes;
}

/**
 * Encrypts all notes into a fresh vault (one passkey prompt; a new random salt every save) and stores it, signed by
 * the account's open signing session so nobody else can overwrite it.
 */
export async function saveNotes(address: `0x${string}`, credentialId: string, notes: Notes) {
  const secret = new TextEncoder().encode(JSON.stringify({ v: 1, notes }));
  const vault = JSON.stringify(await createSecretVaultWithExistingPasskey({ rpId: rpId(), credential: { credentialId }, secret }));
  const at = Date.now();
  const signature = await walletClient().signMessage({ message: notesMessage(address, at, vault) });
  const r = await fetch("/api/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, at, vault, signature }) });
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save your notes");
}
