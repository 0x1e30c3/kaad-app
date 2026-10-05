import { drip } from "@/lib/drip";

/** POST { address } → sends a little testnet MON for gas to an account that has (almost) none. */
export async function POST(req: Request) {
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const r = await drip(address ?? "", ip);
  return Response.json(r, { status: r.ok ? 200 : r.status });
}
