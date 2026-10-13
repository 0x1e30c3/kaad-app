import { isAddress, verifyMessage } from "viem";
import { parseSecretVault } from "@category-labs/mera";
import { kv, KV_READY } from "@/lib/kv";
import { notesMessage } from "@/lib/notesMessage";

// Encrypted private notes (see lib/notes.ts). The server stores one Mera secret vault per account and never sees a key
// or plaintext. Writes must be signed by the account, carry a recent timestamp, and be newer than what's stored, so an
// old signed vault can't be replayed over a newer one.
const key = (a: string) => `notes:${a.toLowerCase()}`;
const MAX_VAULT = 32_000; // ~1000 notes' worth of ciphertext
const SKEW = 5 * 60_000;

type Stored = { at: number; vault: string };

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(address)) return Response.json({ error: "Bad address" }, { status: 400 });
  if (!KV_READY) return Response.json({ ready: false, vault: null, error: "Private notes need storage that isn't set up on this deployment" });
  const raw = await kv<string | null>("GET", key(address)).catch(() => undefined);
  if (raw === undefined) return Response.json({ ready: false, vault: null, error: "Storage is unreachable right now" }, { status: 503 });
  const stored = raw ? (JSON.parse(raw) as Stored) : null;
  return Response.json({ ready: true, vault: stored?.vault ?? null, at: stored?.at ?? null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!KV_READY) return Response.json({ error: "Private notes need storage that isn't set up on this deployment" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { address?: string; at?: number; vault?: string; signature?: `0x${string}` } | null;
  const { address, at, vault, signature } = body ?? {};
  if (!address || !isAddress(address) || typeof at !== "number" || typeof vault !== "string" || !signature) return Response.json({ error: "Bad request" }, { status: 400 });
  if (vault.length > MAX_VAULT) return Response.json({ error: "Notes are too large" }, { status: 413 });
  if (Math.abs(Date.now() - at) > SKEW) return Response.json({ error: "Clock out of sync. Try again." }, { status: 400 });
  try {
    parseSecretVault(vault); // must be a well-formed Mera vault; it stays opaque to us
  } catch {
    return Response.json({ error: "Not a valid vault" }, { status: 400 });
  }
  const ok = await verifyMessage({ address, message: notesMessage(address, at, vault), signature }).catch(() => false);
  if (!ok) return Response.json({ error: "Signature doesn't match this account" }, { status: 401 });

  const raw = await kv<string | null>("GET", key(address));
  if (raw && (JSON.parse(raw) as Stored).at >= at) return Response.json({ error: "A newer version is already saved. Reload and try again." }, { status: 409 });
  await kv("SET", key(address), JSON.stringify({ at, vault } satisfies Stored));
  return Response.json({ ok: true });
}
