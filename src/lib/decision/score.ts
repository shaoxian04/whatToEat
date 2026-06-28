import type { LatLng, Restaurant } from "@/lib/decision/types";
import { haversineMeters } from "@/lib/decision/distance";

export interface ScoreWeights {
  rating: number;
  distance: number;
  openNow: number;
  price: number;
}

export interface ScoreConfig {
  weights: ScoreWeights;
  bayesMinCount: number;     // m
  priorMeanFallback: number; // C fallback when the pool has no ratings
  maxDistanceMeters: number; // distance normalisation ceiling
}

export interface ScoreBreakdown {
  adjustedRating: number;
  ratingScore: number;
  distanceScore: number;
  openNowScore: number;
  priceScore: number;
}

export interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number;
  breakdown: ScoreBreakdown;
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  weights: { rating: 0.6, distance: 0.3, openNow: 0.1, price: 0 },
  bayesMinCount: 50,
  priorMeanFallback: 3.8,
  maxDistanceMeters: 5000,
};

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function bayesianRating(
  rating: number | null,
  count: number | null,
  priorMean: number,
  minCount: number,
): number {
  const v = count ?? 0;
  if (v <= 0) return priorMean;
  const R = rating ?? priorMean;
  return (v / (v + minCount)) * R + (minCount / (v + minCount)) * priorMean;
}

export function scoreRestaurant(
  r: Restaurant,
  origin: LatLng,
  poolMean: number,
  config: ScoreConfig,
): ScoredRestaurant {
  const adjustedRating = bayesianRating(r.rating, r.userRatingCount ?? null, poolMean, config.bayesMinCount);
  const ratingScore = adjustedRating / 5;
  const dist = haversineMeters(origin, { lat: r.lat, lng: r.lng });
  const distanceScore = 1 - clamp(dist / config.maxDistanceMeters, 0, 1);
  const openNowScore = r.openNow === true ? 1 : r.openNow === null ? 0.5 : 0;
  const priceScore = 0; // carried in the model but not scored in v1 (needs a user preference)
  const w = config.weights;
  const score =
    w.rating * ratingScore +
    w.distance * distanceScore +
    w.openNow * openNowScore +
    w.price * priceScore;
  return { restaurant: r, score, breakdown: { adjustedRating, ratingScore, distanceScore, openNowScore, priceScore } };
}

function mergeConfig(p: Partial<ScoreConfig>): ScoreConfig {
  return {
    ...DEFAULT_SCORE_CONFIG,
    ...p,
    weights: { ...DEFAULT_SCORE_CONFIG.weights, ...(p.weights ?? {}) },
  };
}

function poolMeanRating(pool: Restaurant[], fallback: number): number {
  const rated = pool.filter((r): r is Restaurant & { rating: number } => r.rating !== null);
  if (rated.length === 0) return fallback;
  return rated.reduce((sum, r) => sum + r.rating, 0) / rated.length;
}

export function rankRestaurants(
  pool: Restaurant[],
  origin: LatLng,
  config: Partial<ScoreConfig> = {},
): ScoredRestaurant[] {
  const cfg = mergeConfig(config);
  const poolMean = poolMeanRating(pool, cfg.priorMeanFallback);
  return pool
    .map((r) => scoreRestaurant(r, origin, poolMean, cfg))
    .sort((a, b) => b.score - a.score);
}

export function weightedPick(
  scored: ScoredRestaurant[],
  rng: () => number = Math.random,
  previousId?: string,
): Restaurant | null {
  if (scored.length === 0) return null;
  const candidates =
    previousId && scored.length > 1
      ? scored.filter((s) => s.restaurant.placeId !== previousId)
      : scored;
  const weights = candidates.map((s) => Math.max(s.score, 0));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    return candidates[Math.floor(rng() * candidates.length)].restaurant;
  }
  let threshold = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    threshold -= weights[i];
    if (threshold < 0) return candidates[i].restaurant;
  }
  return candidates[candidates.length - 1].restaurant;
}
