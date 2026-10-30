import { describe, it, expect } from "vitest";
import { applyFilters, cuisineOptions, cuisineLabel } from "@/lib/decision/filter";
import type { Restaurant } from "@/lib/decision/types";

const origin = { lat: 0, lng: 0 };

function r(over: Partial<Restaurant>): Restaurant {
  return {
    placeId: "x", name: "x", rating: 4, priceLevel: 2,
    lat: 0, lng: 0, openNow: true, types: ["restaurant"], photoRef: null, ...over,
  };
}

describe("applyFilters", () => {
  it("returns all when criteria is empty", () => {
    const pool = [r({ placeId: "a" }), r({ placeId: "b" })];
    expect(applyFilters(pool, origin, {})).toHaveLength(2);
  });

  it("filters out places beyond maxDistanceMeters", () => {
    const near = r({ placeId: "near", lat: 0, lng: 0 });
    const far = r({ placeId: "far", lat: 1, lng: 1 }); // ~157km away
    const out = applyFilters([near, far], origin, { maxDistanceMeters: 1000 });
    expect(out.map((x) => x.placeId)).toEqual(["near"]);
  });

  it("filters by maxPriceLevel, minRating, openNow, and cuisine", () => {
    const pool = [
      r({ placeId: "keep", priceLevel: 2, rating: 4.5, openNow: true, types: ["restaurant", "sushi"] }),
      r({ placeId: "pricey", priceLevel: 4 }),
      r({ placeId: "lowrated", rating: 2 }),
      r({ placeId: "closed", openNow: false }),
      r({ placeId: "wrongcuisine", types: ["restaurant", "pizza"] }),
    ];
    const out = applyFilters(pool, origin, {
      maxPriceLevel: 3, minRating: 3.5, openNow: true, cuisine: "sushi",
    });
    expect(out.map((x) => x.placeId)).toEqual(["keep"]);
  });

  it("drops unrated places under a rating filter but keeps unknown-price places under a price filter", () => {
    const pool = [r({ placeId: "n", rating: null, priceLevel: null })];
    expect(applyFilters(pool, origin, {})).toHaveLength(1);
    expect(applyFilters(pool, origin, { minRating: 3 })).toHaveLength(0);
    expect(applyFilters(pool, origin, { maxPriceLevel: 2 })).toHaveLength(1);
  });
});

describe("cuisineOptions", () => {
  it("lists cuisines from *_restaurant types, most common first, ignoring generic ones", () => {
    const pool = [
      r({ placeId: "a", types: ["restaurant", "japanese_restaurant"] }),
      r({ placeId: "b", types: ["japanese_restaurant", "sushi_restaurant"] }),
      r({ placeId: "c", types: ["fast_food_restaurant", "food"] }),
    ];
    expect(cuisineOptions(pool)).toEqual([
      { value: "japanese_restaurant", label: "Japanese", count: 2 },
      { value: "sushi_restaurant", label: "Sushi", count: 1 },
    ]);
  });

  it("labels multi-word cuisines", () => {
    expect(cuisineLabel("middle_eastern_restaurant")).toBe("Middle Eastern");
  });
});
