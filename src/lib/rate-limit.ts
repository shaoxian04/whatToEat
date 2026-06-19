const MAX_KEYS = 10_000;

export function createRateLimiter(maxPerWindow: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now: number = Date.now()): boolean {
    // Periodic sweep: when the map exceeds MAX_KEYS, evict entries whose
    // timestamps are all outside the window (internal memory optimization;
    // does not affect the allow/block decision for any key).
    if (hits.size > MAX_KEYS) {
      for (const [k, times] of hits) {
        if (times.every((t) => now - t >= windowMs)) {
          hits.delete(k);
        }
      }
    }

    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= maxPerWindow) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}
