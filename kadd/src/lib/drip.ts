// Gas drip: sends a little testnet MON to brand-new passkey accounts so their first transaction just works (judges
// and first-time users have 0 MON). Server-only: DRIP_PRIVATE_KEY is a dedicated, testnet-only hot wallet.
import "server-only";
import { createWalletClient, formatEther, isAddress, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, publicClient, transport } from "./chain";

// Covers a first session: faucet + approvals + a few swaps + one pool or club creation (≈0.15–0.18 MON each).
export const DRIP_AMOUNT = parseEther(process.env.DRIP_AMOUNT_MON || "0.25");
const MIN_BALANCE = parseEther("0.05"); // only accounts that can't afford a normal session
const DAY = 24 * 3600_000;
const HOUR = 3600_000;
const PER_IP_PER_DAY = 3;
const GLOBAL_PER_HOUR = 60;

// ponytail: limits live in this server instance's memory (reset on cold start, not shared across instances);
// move them to Redis/KV if abuse shows up. The wallet only ever holds testnet MON.
const lastByAddress = new Map<string, number>();
const hitsByIp = new Map<string, number[]>();
let recent: number[] = [];

export type DripResult = { ok: true; hash: `0x${string}`; amount: string } | { ok: false; status: number; error: string };

export async function drip(address: string, ip: string, now = Date.now()): Promise<DripResult> {
  const key = process.env.DRIP_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) return { ok: false, status: 503, error: "Gas drip isn't configured." };
  if (!isAddress(address)) return { ok: false, status: 400, error: "Invalid address." };
  const a = address.toLowerCase();

  if (now - (lastByAddress.get(a) ?? 0) < DAY) return { ok: false, status: 429, error: "Already sent gas to this account today." };
  const ipHits = (hitsByIp.get(ip) ?? []).filter((t) => now - t < DAY);
  if (ipHits.length >= PER_IP_PER_DAY) return { ok: false, status: 429, error: "Gas limit reached for today. Use faucet.monad.xyz." };
  recent = recent.filter((t) => now - t < HOUR);
  if (recent.length >= GLOBAL_PER_HOUR) return { ok: false, status: 429, error: "Gas drip is busy. Try again in a few minutes." };
  if ((await publicClient.getBalance({ address })) >= MIN_BALANCE) return { ok: false, status: 400, error: "You already have enough MON for gas." };

  const account = privateKeyToAccount(key);
  if ((await publicClient.getBalance({ address: account.address })) < DRIP_AMOUNT + parseEther("0.01"))
    return { ok: false, status: 503, error: "The gas drip wallet is empty. Use faucet.monad.xyz for now." };

  // Reserve before sending so two parallel requests can't both pass the checks.
  lastByAddress.set(a, now);
  hitsByIp.set(ip, [...ipHits, now]);
  recent.push(now);
  try {
    const wallet = createWalletClient({ account, chain, transport: transport() });
    const hash = await wallet.sendTransaction({ to: address, value: DRIP_AMOUNT });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("reverted");
    return { ok: true, hash, amount: formatEther(DRIP_AMOUNT) };
  } catch (e) {
    lastByAddress.delete(a);
    hitsByIp.set(ip, ipHits);
    recent.pop();
    console.error("[drip] send failed", e);
    return { ok: false, status: 502, error: "Couldn't send gas right now. Try again." };
  }
}
