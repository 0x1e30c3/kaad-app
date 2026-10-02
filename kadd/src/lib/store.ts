"use client";
// Client-side app state, persisted to localStorage.
// The account is real (Mera passkey) and trades are real Monad testnet transactions (see swap.ts); balances are read
// from chain. Kept here: cost basis + trade history for PnL, the watchlist, and groups (local until there's a backend).
import { useSyncExternalStore } from "react";
import { GROUPS, type Group } from "./mock";
import type { TokenRef } from "./market";
import { isUnlocked, unlock } from "./wallet";

export type Fill = TokenRef & { side: "buy" | "sell"; usd: number; amount: number; at: number; hash: string };
export type Toast = { id: number; msg: string; tone: "ok" | "err" };

type State = {
  user: { address: `0x${string}`; name: string; credentialId: string } | null;
  /** tUSDC spent per mainnet token still held (cost basis for PnL), keyed by mainnet address. */
  costs: Record<string, number>;
  fills: Fill[];
  watchlist: TokenRef[];
  joined: string[];
  myGroups: Group[];
  // not persisted
  loginOpen: boolean;
  toasts: Toast[];
  /** Bumped after every confirmed transaction so components re-read balances from chain. */
  rev: number;
};

const EMPTY: State = { user: null, costs: {}, fills: [], watchlist: [], joined: [], myGroups: [], loginOpen: false, toasts: [], rev: 0 };
const KEY = "kadd:v1";

function load(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved) return EMPTY;
    // Older versions stored bare addresses for mock tokens; keep only entries that carry their own symbol.
    const refs = <T,>(xs: unknown): T[] => (Array.isArray(xs) ? xs.filter((x) => x && typeof x === "object" && "symbol" in x) : []);
    // Demo-era balances/positions/fills (no tx hash) are dropped; trades are onchain now.
    const fills = refs<Fill>(saved.fills).filter((f) => f.hash);
    return { ...EMPTY, user: saved.user ?? null, costs: saved.costs ?? {}, fills, watchlist: refs(saved.watchlist), joined: saved.joined ?? [], myGroups: saved.myGroups ?? [] };
  } catch {
    return EMPTY;
  }
}

let state: State = typeof window === "undefined" ? EMPTY : load();
const listeners = new Set<() => void>();

function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, loginOpen: undefined, toasts: undefined, rev: undefined }));
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
  // Each passkey is its own account; switching accounts resets the per-account cost basis and history.
  const reset = known ? {} : { costs: {}, fills: [] };
  set({ user: { address, name: "you", credentialId }, loginOpen: false, ...reset });
  if (prev && !known) toast("Switched to another passkey account");
  else toast(known ? "Unlocked with your passkey" : "Signed in with your passkey");
}

export function logout() {
  set({ ...EMPTY });
}

export const ref = ({ address, symbol, name, image }: TokenRef): TokenRef => ({ address, symbol, name, image });

/** Records a confirmed swap: history + cost basis (a sell of x% releases x% of the cost). */
export function recordFill(f: Fill, soldFraction = 0) {
  set((s) => {
    const cost = s.costs[f.address] ?? 0;
    const next = f.side === "buy" ? cost + f.usd : cost * (1 - soldFraction);
    return { fills: [f, ...s.fills].slice(0, 100), costs: { ...s.costs, [f.address]: next }, rev: s.rev + 1 };
  });
}

/** Re-read chain state (balances) after a transaction that isn't a swap, e.g. a faucet claim or club deposit. */
export const refreshChain = () => set((s) => ({ rev: s.rev + 1 }));

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
