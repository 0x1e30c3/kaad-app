"use client";
// Passkey account via Mera: passkey PRF (32 bytes) -> BIP-39 -> BIP-32 m/44'/60'/0'/0/0 -> in-memory signing session.
// Nothing secret is stored. Only the credential id + address are kept so the UI can show who is logged in;
// after a reload the session is locked until the passkey is used again.
import { createPasskeyWithPrfOutput, createSecp256k1SigningSession, getPasskeyPrfOutput, isMeraError, type Secp256k1SigningSession } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { createWalletClient, formatEther, type LocalAccount } from "viem";
import { chain, publicClient, transport } from "./chain";
export { chain, publicClient };

let session: Secp256k1SigningSession | null = null;
let account: LocalAccount | null = null;

function startSession(prfOutput: Uint8Array) {
  // ponytail: the mnemonic string can't be zeroed in JS; everything byte-based is wiped right after use.
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const master = HDKey.fromMasterSeed(seed);
  const node = master.derive("m/44'/60'/0'/0/0");
  session?.end();
  session = createSecp256k1SigningSession({ privateKey: node.privateKey! });
  node.wipePrivateData();
  master.wipePrivateData();
  seed.fill(0);
  prfOutput.fill(0);
  account = toViemAccount(session);
  return account.address;
}

const rp = () => ({ id: location.hostname, name: "Kadd" });

/** New user: creates a passkey on this device and derives the account from it. */
export async function createAccount() {
  const res = await createPasskeyWithPrfOutput({ rp: rp(), user: { name: `kadd-${Date.now().toString(36)}`, displayName: "Kadd" } });
  return { address: startSession(res.prfOutput), credentialId: res.credentialId };
}

/**
 * Returning user. Each passkey derives its own account: the same passkey always gives the same address (on any
 * device it syncs to), a different passkey gives a different one. Pass `credentialId` to pin the known passkey.
 */
export async function unlock(credentialId?: string) {
  const res = await getPasskeyPrfOutput({ rpId: rp().id, credential: credentialId ? { credentialId } : undefined });
  return { address: startSession(res.prfOutput), credentialId: res.credentialId };
}

export function lock() {
  session?.end();
  session = null;
  account = null;
}

export const isUnlocked = () => account !== null;

export function walletClient() {
  if (!account) throw new Error("Account locked, sign in with your passkey first");
  return createWalletClient({ account, chain, transport: transport() });
}

export async function getMonBalance(address: `0x${string}`) {
  return Number(formatEther(await publicClient.getBalance({ address })));
}

export function passkeyError(e: unknown): string {
  if (isMeraError(e)) {
    if (e.code === "PRF_UNAVAILABLE") return "This device or browser doesn't support passkey PRF yet. Try the latest Chrome or Safari with iCloud Keychain, Google Password Manager, or 1Password.";
    if (e.code === "PASSKEY_OPERATION_FAILED") return "Passkey canceled or unavailable.";
  }
  return "Passkey failed. Try again.";
}
