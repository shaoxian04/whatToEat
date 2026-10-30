import { describe, it, expect } from "vitest";
import { bayesianRating, scoreRestaurant, DEFAULT_SCORE_CONFIG, rankRestaurants, weightedPick } from "@/lib/decision/score";
import type { Restaurant } from "@/lib/decision/types";
import type { ScoredRestaurant } from "@/lib/decision/score";

const ORIGIN = { lat: 1.3, lng: 103.8 };

function r(over: Partial<Restaurant> = {}): Restaurant {
  return {
    placeId: "p", name: "P", rating: 4.0, userRatingCount: 100, priceLevel: null,
    lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null, ...over,
  };
}

describe("bayesianRating", () => {
  it("keeps the rating when the review count is high", () => {
    expect(bayesianRating(4.5, 3000, 3.8, 50)).toBeCloseTo(4.49, 1);
  });
  it("pulls low-count ratings toward the prior mean", () => {
    expect(bayesianRating(4.9, 12, 3.8, 50)).toBeCloseTo(4.01, 1);
  });
  it("ranks a credible 4.5/3000 above a shiny 4.9/12", () => {
    expect(bayesianRating(4.5, 3000, 3.8, 50)).toBeGreaterThan(bayesianRating(4.9, 12, 3.8, 50));
  });
  it("returns the prior mean when rating or count is missing", () => {
    expect(bayesianRating(null, null, 3.8, 50)).toBe(3.8);
    expect(bayesianRating(4.9, 0, 3.8, 50)).toBe(3.8);
    expect(bayesianRating(4.9, null, 3.8, 50)).toBe(3.8);
  });
});

describe("scoreRestaurant", () => {
  it("combines rating, distance and open-now with the default weights", () => {
    const scored = scoreRestaurant(r({ rating: 4.5, userRatingCount: 3000, openNow: true }), ORIGIN, 3.8, DEFAULT_SCORE_CONFIG);
    expect(scored.breakdown.distanceScore).toBe(1); // at origin
    expect(scored.breakdown.openNowScore).toBe(1);
    expect(scored.breakdown.priceScore).toBe(0);
    expect(scored.score).toBeCloseTo(0.939, 2);
  });
  it("gives a neutral 0.5 open-now score when open status is unknown", () => {
    const scored = scoreRestaurant(r({ openNow: null }), ORIGIN, 3.8, DEFAULT_SCORE_CONFIG);
    expect(scored.breakdown.openNowScore).toBe(0.5);
  });
  it("treats a missing userRatingCount as zero reviews (shrinks to pool mean)", () => {
    const scored = scoreRestaurant(r({ rating: 4.9, userRatingCount: null }), ORIGIN, 3.8, DEFAULT_SCORE_CONFIG);
    expect(scored.breakdown.adjustedRating).toBe(3.8);
  });
});

function sr(id: string, score: number): ScoredRestaurant {
  return {
    restaurant: r({ placeId: id, name: id }),
    score,
    breakdown: { adjustedRating: 0, ratingScore: 0, distanceScore: 0, openNowScore: 0, priceScore: 0 },
  };
}

describe("rankRestaurants", () => {
  it("returns an empty array for an empty pool", () => {
    expect(rankRestaurants([], ORIGIN)).toEqual([]);
  });
  it("orders best-first and ranks a credible spot above a shiny low-count one", () => {
    const pool = [
      r({ placeId: "shiny", name: "shiny", rating: 4.9, userRatingCount: 4 }),
      r({ placeId: "credible", name: "credible", rating: 4.5, userRatingCount: 4000 }),
      r({ placeId: "dive", name: "dive", rating: 2.5, userRatingCount: 300 }),
    ];
    const ranked = rankRestaurants(pool, ORIGIN);
    expect(ranked.map((s) => s.restaurant.placeId)).toEqual(["credible", "shiny", "dive"]);
  });
  it("uses the prior-mean fallback when no restaurant has a rating", () => {
    const ranked = rankRestaurants([r({ rating: null, userRatingCount: null })], ORIGIN);
    expect(ranked[0].breakdown.adjustedRating).toBe(DEFAULT_SCORE_CONFIG.priorMeanFallback);
  });
});

describe("weightedPick", () => {
  it("returns null for an empty list", () => {
    expect(weightedPick([])).toBeNull();
  });
  it("returns the only item", () => {
    expect(weightedPick([sr("a", 0.5)])?.placeId).toBe("a");
  });
  it("selects proportionally to score using rng", () => {
    const scored = [sr("a", 0.9), sr("b", 0.1)]; // total 1.0
    expect(weightedPick(scored, () => 0)?.placeId).toBe("a");
    expect(weightedPick(scored, () => 0.95)?.placeId).toBe("b");
  });
  it("excludes the previous pick when alternatives exist", () => {
    const scored = [sr("a", 0.9), sr("b", 0.1)];
    expect(weightedPick(scored, () => 0, "a")?.placeId).toBe("b");
  });
  it("falls back to uniform selection when all scores are zero", () => {
    const scored = [sr("a", 0), sr("b", 0)];
    expect(weightedPick(scored, () => 0)?.placeId).toBe("a");
    expect(weightedPick(scored, () => 0.99)?.placeId).toBe("b");
  });
});
