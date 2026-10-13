import { createPublicClient, http } from "viem";
import { monad } from "viem/chains";
import { hot, isAddress, searchTokens } from "@/lib/market";

const mainnet = createPublicClient({ chain: monad, transport: http(process.env.MAINNET_RPC_URL || undefined) });

/** A wallet, not a contract: no code, or only an EIP-7702 delegation (0xef0100 + address) on an EOA. */
async function isWallet(address: `0x${string}`) {
  try {
    const code = await mainnet.getCode({ address }); // viem: undefined when the address has no code
    return !code || code === "0x" || code.toLowerCase().startsWith("0xef0100");
  } catch {
    return false; // RPC failed: fall back to treating it as a token
  }
}

/**
 * Header search. Empty query → what's hot right now. A pasted address resolves to a wallet (→ its profile, spot and
 * perps) or a token (→ its page); anything else searches tokens by name or symbol.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  try {
    if (isAddress(q) && (await isWallet(q as `0x${string}`))) return Response.json([{ address: q.toLowerCase(), wallet: true }]);
    return Response.json((await (q ? searchTokens(q) : hot())).slice(0, 8));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Search failed" }, { status: 502 });
  }
}
