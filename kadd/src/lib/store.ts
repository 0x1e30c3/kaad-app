"use client";
// Client-side app state, persisted to localStorage.
// The account is real (Mera passkey); balance, positions and fills are a demo simulation until Kuru trading is
// wired. Token prices are live Monad mainnet data. Groups are local until there's a shared backend.
import { useSyncExternalStore } from "react";
import { GROUPS, type Group } from "./mock";
import type { TokenRef } from "./market";
import { isUnlocked, unlock } from "./wallet";

export type Position = TokenRef & { amount: number; cost: number }; // cost = USDC spent
export type Fill = TokenRef & { side: "buy" | "sell"; usd: number; amount: number; at: number };
export type Toast = { id: number; msg: string; tone: "ok" | "err" };

type State = {
  user: { address: `0x${string}`; name: string; credentialId: string } | null;
  balance: number;
  positions: Position[];
  fills: Fill[];
  watchlist: TokenRef[];
  joined: string[];
  myGroups: Group[];
  // not persisted
  loginOpen: boolean;
  toasts: Toast[];
};

const EMPTY: State = { user: null, balance: 0, positions: [], fills: [], watchlist: [], joined: [], myGroups: [], loginOpen: false, toasts: [] };
const KEY = "kadd:v1";

function load(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved) return EMPTY;
    // Older versions stored bare addresses for mock tokens; keep only entries that carry their own symbol.
    const refs = <T,>(xs: unknown): T[] => (Array.isArray(xs) ? xs.filter((x) => x && typeof x === "object" && "symbol" in x) : []);
    return { ...EMPTY, ...saved, positions: refs(saved.positions), fills: refs(saved.fills), watchlist: refs(saved.watchlist), loginOpen: false, toasts: [] };
  } catch {
    return EMPTY;
  }
}

let state: State = typeof window === "undefined" ? EMPTY : load();
const listeners = new Set<() => void>();

function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, loginOpen: undefined, toasts: undefined }));
  } catch {}
  listeners.forEach((l) => l());
}

export function useStore() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
    () => EMPTY,
  );
}

let toastId = 0;
export function toast(msg: string, tone: Toast["tone"] = "ok") {
  const id = ++toastId;
  set((s) => ({ toasts: [...s.toasts, { id, msg, tone }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2800);
}

export const openLogin = (open = true) => set({ loginOpen: open });

/** Called after Mera derived the account from the passkey. */
export function login(address: `0x${string}`, credentialId: string) {
  const prev = state.user?.address;
  const known = prev === address;
  // ponytail: 250 demo USDC until Kuru trading is wired; the account itself is real.
  const demo = known ? {} : { balance: 250, positions: [], fills: [] };
  set({ user: { address, name: "you", credentialId }, loginOpen: false, ...demo });
  // Each passkey is its own account; picking a different one switches accounts (and resets the demo balance).
  if (prev && !known) toast("Switched to another passkey account");
  else toast(known ? "Unlocked with your passkey" : "Signed in with your passkey");
}

export function logout() {
  set({ ...EMPTY });
}

const ref = ({ address, symbol, name, image }: TokenRef): TokenRef => ({ address, symbol, name, image });

/** Simulated trade at the live price against the demo balance. Returns true when it went through. */
export function trade(t: TokenRef & { price: number }, side: "buy" | "sell", value: number): boolean {
  if (!state.user) return openLogin(), false;
  if (!(value > 0)) return toast("Enter an amount first", "err"), false;
  if (!(t.price > 0)) return toast("No live price for this token yet", "err"), false;
  const pos = state.positions.find((p) => p.address === t.address);

  if (side === "buy") {
    if (value > state.balance) return toast("Not enough demo balance", "err"), false;
    const amount = value / t.price;
    set((s) => ({
      balance: s.balance - value,
      positions: pos
        ? s.positions.map((p) => (p === pos ? { ...p, amount: p.amount + amount, cost: p.cost + value } : p))
        : [...s.positions, { ...ref(t), amount, cost: value }],
      fills: [{ ...ref(t), side, usd: value, amount, at: Date.now() }, ...s.fills],
    }));
    toast(`Demo: bought ${value} USDC of ${t.symbol}`);
    return true;
  }

  // sell: value is a percentage of the position
  if (!pos) return toast(`You don't hold any ${t.symbol}`, "err"), false;
  const frac = Math.min(value, 100) / 100;
  const amount = pos.amount * frac;
  const usd = amount * t.price;
  set((s) => ({
    balance: s.balance + usd,
    positions: frac >= 1 ? s.positions.filter((p) => p !== pos) : s.positions.map((p) => (p === pos ? { ...p, amount: p.amount - amount, cost: p.cost * (1 - frac) } : p)),
    fills: [{ ...ref(t), side, usd, amount, at: Date.now() }, ...s.fills],
  }));
  toast(`Demo: sold ${Math.round(frac * 100)}% of ${t.symbol} for ${usd.toFixed(2)} USDC`);
  return true;
}

export const isWatched = (s: State, address: string) => s.watchlist.some((w) => w.address === address);

export function toggleWatch(t: TokenRef) {
  const on = isWatched(state, t.address);
  set((s) => ({ watchlist: on ? s.watchlist.filter((w) => w.address !== t.address) : [...s.watchlist, ref(t)] }));
  toast(on ? "Removed from watchlist" : "Added to watchlist");
}

export const allGroups = (s: State) => [...s.myGroups, ...GROUPS];

export function joinGroup(id: string) {
  if (!state.user) return openLogin();
  if (state.joined.includes(id)) return;
  set((s) => ({ joined: [...s.joined, id] }));
  toast("Joined the group");
}

export function leaveGroup(id: string) {
  set((s) => ({ joined: s.joined.filter((g) => g !== id) }));
  toast("Left the group");
}

export function joinByCode(code: string) {
  const g = allGroups(state).find((g) => g.code.toLowerCase() === code.trim().toLowerCase());
  if (!g) return toast("Invite code not found", "err"), null;
  joinGroup(g.id);
  return g.id;
}

export function createGroup(name: string, desc: string) {
  if (!state.user) return openLogin(), null;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36).slice(-4);
  const code = "KADD-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const g: Group = { id, name, desc, code, members: [state.user.address] };
  set((s) => ({ myGroups: [g, ...s.myGroups], joined: [...s.joined, id] }));
  toast(`Group "${name}" created`);
  return id;
}

/**
 * Returns the passkey account address ready to sign, prompting for the passkey if the session is locked.
 * Returns null (and opens the login dialog) when nobody is logged in. Call from a click handler.
 */
export async function requireAccount(): Promise<`0x${string}` | null> {
  if (!state.user) return openLogin(), null;
  if (isUnlocked()) return state.user.address;
  const r = await unlock(state.user.credentialId);
  if (r.address.toLowerCase() !== state.user.address.toLowerCase()) login(r.address, r.credentialId);
  else set({}); // re-render: session is now unlocked
  return r.address;
}
