// Server-side stale-while-revalidate memo for slow upstreams (RPC, HyperRPC, GeckoTerminal, DexScreener).
import "server-only";

type Entry = { at: number; has: boolean; value?: unknown; pending?: Promise<unknown> };
// On globalThis so every route bundle in the server process shares one cache.
const g = globalThis as { __kaddSwr?: Map<string, Entry> };
const store = (g.__kaddSwr ??= new Map());

/**
 * Within `ttlMs` the cached value is returned. After that the stale value is still returned at once while a single
 * background refresh runs. Concurrent callers share one fetch, and a failed refresh keeps the last good value, so
 * only the very first call ever waits on the network.
 * ponytail: per-process memory, never evicted; fine for a few hundred keys, add an LRU if wallet keys pile up.
 */
export function swr<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  let e = store.get(key);
  if (!e) store.set(key, (e = { at: 0, has: false }));
  const entry = e;
  const refresh = () =>
    (entry.pending ??= fn().then(
      (v) => {
        Object.assign(entry, { value: v, has: true, at: Date.now(), pending: undefined });
        return v;
      },
      (err) => {
        entry.pending = undefined;
        throw err;
      },
    )) as Promise<T>;
  if (!entry.has) return refresh();
  if (Date.now() - entry.at > ttlMs) refresh().catch((err) => console.error(`refresh ${key} failed:`, err));
  return Promise.resolve(entry.value as T);
}
