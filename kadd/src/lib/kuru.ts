// Kuru Flow (Monad mainnet): quotes and ready-to-send swap transactions routed through Kuru's onchain order books
// (and other Monad venues when they price better). Server-only: keeps the per-user JWTs and Kuru's rate limit here.
import "server-only";
import { getAddress, isAddress } from "viem";

const API = "https://ws.kuru.io";
export const MON = "0x0000000000000000000000000000000000000000";

const g = globalThis as { __kuruJwt?: Map<string, { token: string; expiresAt: number }> };
const jwts = (g.__kuruJwt ??= new Map());

async function jwt(user: string) {
  const hit = jwts.get(user);
  if (hit && hit.expiresAt * 1000 > Date.now() + 60_000) return hit.token;
  const res = await fetch(`${API}/api/generate-token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user_address: user }), cache: "no-store" });
  if (!res.ok) throw new Error(`Kuru auth failed (${res.status})`);
  const j = (await res.json()) as { token: string; expires_at: number };
  jwts.set(user, { token: j.token, expiresAt: j.expires_at });
  return j.token;
}

export type KuruQuote = { output: string; minOut: string; to: `0x${string}`; data: `0x${string}`; value: string };

/** A swap quote with its transaction. `amount` in the input token's smallest units; MON is the zero address. */
export async function kuruQuote(q: { user: string; tokenIn: string; tokenOut: string; amount: string; slippageBps?: number }): Promise<KuruQuote> {
  for (const a of [q.user, q.tokenIn, q.tokenOut]) if (!isAddress(a, { strict: false })) throw new Error("Bad address");
  if (!/^\d+$/.test(q.amount) || BigInt(q.amount) === 0n) throw new Error("Bad amount");
  const user = getAddress(q.user);
  const body: Record<string, unknown> = { userAddress: user, tokenIn: q.tokenIn, tokenOut: q.tokenOut, amount: q.amount };
  if (q.slippageBps) body.slippageTolerance = Math.min(Math.max(Math.round(q.slippageBps), 1), 5000);
  else body.autoSlippage = true;
  // Optional integrator fee (Kadd's business model on mainnet): set KURU_REFERRER + KURU_REFERRER_BPS.
  if (process.env.KURU_REFERRER && isAddress(process.env.KURU_REFERRER)) {
    body.referrerAddress = process.env.KURU_REFERRER;
    body.referrerFeeBps = Number(process.env.KURU_REFERRER_BPS) || 0;
  }
  const res = await fetch(`${API}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await jwt(user)}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => null)) as { status?: string; message?: string; output: string; minOut: string; transaction: { to: string; calldata: string; value: string } } | null;
  if (!res.ok || j?.status !== "success") throw new Error(j?.message || `No route found (${res.status})`);
  return { output: j.output, minOut: j.minOut, to: getAddress(j.transaction.to), data: `0x${j.transaction.calldata.replace(/^0x/, "")}`, value: j.transaction.value || "0" };
}
