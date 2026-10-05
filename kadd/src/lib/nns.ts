// Nad Name Service (Monad mainnet): a wallet's primary .nad name and avatar, read straight from the NNS contract
// (the same call @nadnameservice/nns-viem-sdk makes) so it costs no dependency.
import "server-only";
import { createPublicClient, http, type Address } from "viem";
import { monad } from "viem/chains";

export const mainnet = createPublicClient({ chain: monad, transport: http(), batch: { multicall: true } });

const NNS = "0xCc7a1bfF8845573dbF0B3b96e25B9b549d4a2eC7";
const abi = [
  {
    type: "function",
    name: "getProfilesForAddresses",
    stateMutability: "view",
    inputs: [{ name: "addrs", type: "address[]" }],
    outputs: [{ type: "tuple[]", components: [{ name: "addr", type: "address" }, { name: "primaryName", type: "string" }, { name: "avatar", type: "string" }] }],
  },
] as const;

export type Profile = { nns: string | null; avatar: string | null };

/** Only http(s) images; ipfs:// goes through a public gateway. Anything else (data:, javascript:, …) is dropped. */
export function avatarUrl(raw: string) {
  const url = raw.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${raw.slice(7).replace(/^ipfs\//, "")}` : raw;
  return /^https?:\/\//i.test(url) ? url : null;
}

/** Profiles for many wallets in one call, keyed by lowercase address. Empty on failure: names are a nicety. */
export async function profiles(addrs: string[]): Promise<Map<string, Profile>> {
  if (!addrs.length) return new Map();
  const res = await mainnet.readContract({ address: NNS, abi, functionName: "getProfilesForAddresses", args: [addrs as Address[]] }).catch(() => []);
  return new Map(res.map((p) => [p.addr.toLowerCase(), { nns: p.primaryName ? `${p.primaryName}.nad` : null, avatar: avatarUrl(p.avatar) }]));
}
