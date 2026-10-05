import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";

// Read-only Monad testnet client, usable from server and client code. NEXT_PUBLIC_RPC_URL lets the app point at a
// local fork (anvil) for testing; defaults to the public RPC.
export const chain = monadTestnet;
export const transport = () => http(process.env.NEXT_PUBLIC_RPC_URL || undefined);
// Concurrent reads in the same tick are merged into one multicall: the public RPC allows ~15 requests/second.
export const publicClient = createPublicClient({ chain, transport: transport(), batch: { multicall: { wait: 16 } } });
