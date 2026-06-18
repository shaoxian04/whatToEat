import type { Restaurant } from "@/lib/decision/types";

export function pickRandom(
  pool: Restaurant[],
  previousId?: string,
  rng: () => number = Math.random,
): Restaurant | null {
  if (pool.length === 0) return null;
  const candidates =
    previousId && pool.length > 1
      ? pool.filter((r) => r.placeId !== previousId)
      : pool;
  const index = Math.floor(rng() * candidates.length);
  return candidates[index];
}
