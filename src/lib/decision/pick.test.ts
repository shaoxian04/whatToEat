import { describe, it, expect } from "vitest";
import { pickRandom } from "@/lib/decision/pick";
import type { Restaurant } from "@/lib/decision/types";

function r(id: string): Restaurant {
  return { placeId: id, name: id, rating: null, priceLevel: null, lat: 0, lng: 0, openNow: null, types: [], photoRef: null };
}

describe("pickRandom", () => {
  it("returns null for an empty pool", () => {
    expect(pickRandom([])).toBeNull();
  });

  it("returns the only item when pool has one", () => {
    expect(pickRandom([r("a")])?.placeId).toBe("a");
  });

  it("uses rng to choose an index", () => {
    const pool = [r("a"), r("b"), r("c")];
    expect(pickRandom(pool, undefined, () => 0)?.placeId).toBe("a");
    expect(pickRandom(pool, undefined, () => 0.99)?.placeId).toBe("c");
  });

  it("excludes the previous pick when the pool has alternatives", () => {
    const pool = [r("a"), r("b")];
    // rng=0 would normally pick index 0 ("a"); with previous "a" excluded, candidates=["b"]
    expect(pickRandom(pool, "a", () => 0)?.placeId).toBe("b");
  });

  it("ignores previous exclusion when it would empty the pool", () => {
    const pool = [r("a")];
    expect(pickRandom(pool, "a", () => 0)?.placeId).toBe("a");
  });
});
