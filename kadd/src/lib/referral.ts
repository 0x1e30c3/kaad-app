"use client";
// Invites: /start?ref=0x… (or any shared Kadd link) remembers who invited this browser; once the new account has gas,
// it records the inviter onchain in KaddReferrals, once. Stats counts invites and which invitees went on to trade.
import { isAddress, zeroAddress, type Address } from "viem";
import { kaddReferralsAbi } from "./abi";
import { REFERRALS } from "./addresses";
import { send } from "./venue";
import { publicClient } from "./wallet";

export const REFERRALS_READY = REFERRALS !== zeroAddress;
const KEY = "kadd:ref";

/** Remembers `?ref=` from the current URL (first inviter wins). */
export function captureRef() {
  try {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref && isAddress(ref, { strict: false }) && !localStorage.getItem(KEY)) localStorage.setItem(KEY, ref.toLowerCase());
  } catch {}
}

export const inviteLink = (me: string, path = "/start") => `${location.origin}${path}${path.includes("?") ? "&" : "?"}ref=${me.toLowerCase()}`;

/** Records the stored inviter for `me` onchain, once. Silent: invites never get in the way of using the app. */
export async function registerRef(me: Address) {
  if (!REFERRALS_READY) return;
  let ref: string | null = null;
  try {
    ref = localStorage.getItem(KEY);
  } catch {}
  if (!ref || ref === me.toLowerCase()) return;
  try {
    const current = await publicClient.readContract({ address: REFERRALS, abi: kaddReferralsAbi, functionName: "referrerOf", args: [me] });
    if (current === zeroAddress) await send({ address: REFERRALS, abi: kaddReferralsAbi, functionName: "register", args: [ref as Address] });
    localStorage.removeItem(KEY);
  } catch (e) {
    console.warn("[referral]", e);
  }
}
