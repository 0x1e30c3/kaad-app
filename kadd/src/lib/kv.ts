// Tiny Redis over Upstash's REST API (Vercel Marketplace → Upstash, free tier). No client library: one fetch per
// command. Null when not configured, so features that need it can hide.
import "server-only";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const KV_READY = !!(URL_ && TOKEN);

export async function kv<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  if (!KV_READY) throw new Error("KV isn't configured");
  const r = await fetch(URL_!, { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd), cache: "no-store" });
  const j = (await r.json()) as { result?: T; error?: string };
  if (!r.ok || j.error) throw new Error(`kv ${cmd[0]}: ${j.error ?? r.status}`);
  return j.result as T;
}
