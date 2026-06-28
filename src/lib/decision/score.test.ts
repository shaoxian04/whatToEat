import { describe, it, expect } from "vitest";
import { bayesianRating, scoreRestaurant, DEFAULT_SCORE_CONFIG } from "@/lib/decision/score";
import type { Restaurant } from "@/lib/decision/types";

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
