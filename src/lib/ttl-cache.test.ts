import { describe, it, expect } from "vitest";
import { createTtlCache } from "@/lib/ttl-cache";

describe("createTtlCache", () => {
  it("returns a stored value until it expires", () => {
    const cache = createTtlCache<number>(1000, 10);
    cache.set("a", 1, 0);
    expect(cache.get("a", 999)).toBe(1);
    expect(cache.get("a", 1000)).toBeUndefined();
  });

  it("evicts the oldest entry beyond maxEntries", () => {
    const cache = createTtlCache<number>(1000, 2);
    cache.set("a", 1, 0);
    cache.set("b", 2, 0);
    cache.set("c", 3, 0);
    expect(cache.get("a", 0)).toBeUndefined();
    expect(cache.get("b", 0)).toBe(2);
    expect(cache.get("c", 0)).toBe(3);
  });

  it("clear() empties the cache", () => {
    const cache = createTtlCache<number>(1000, 2);
    cache.set("a", 1, 0);
    cache.clear();
    expect(cache.get("a", 0)).toBeUndefined();
  });
});
