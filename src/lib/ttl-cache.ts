// Small in-process TTL cache. Per server instance only (like the rate limiter),
// which is fine for its job: absorbing repeat calls to billed upstream APIs.
export interface TtlCache<V> {
  get(key: string, now?: number): V | undefined;
  set(key: string, value: V, now?: number): void;
  clear(): void;
}

export function createTtlCache<V>(ttlMs: number, maxEntries: number): TtlCache<V> {
  const entries = new Map<string, { value: V; expires: number }>();
  return {
    get(key, now = Date.now()) {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (hit.expires <= now) {
        entries.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value, now = Date.now()) {
      entries.delete(key); // re-insert so Map order tracks recency
      entries.set(key, { value, expires: now + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value as string;
        entries.delete(oldest);
      }
    },
    clear() {
      entries.clear();
    },
  };
}
