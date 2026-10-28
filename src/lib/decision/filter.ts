import type { LatLng, Restaurant } from "@/lib/decision/types";
import { haversineMeters } from "@/lib/decision/distance";

export interface FilterCriteria {
  maxDistanceMeters?: number;
  maxPriceLevel?: number;
  minRating?: number;
  cuisine?: string;
  openNow?: boolean;
}

export function applyFilters(
  pool: Restaurant[],
  origin: LatLng,
  c: FilterCriteria,
): Restaurant[] {
  return pool.filter((p) => {
    if (c.maxDistanceMeters !== undefined &&
        haversineMeters(origin, { lat: p.lat, lng: p.lng }) > c.maxDistanceMeters) {
      return false;
    }
    // Unknown price passes: many places have no price level on Google, and
    // silently hiding them makes the filter look broken.
    if (c.maxPriceLevel !== undefined &&
        p.priceLevel !== null && p.priceLevel > c.maxPriceLevel) {
      return false;
    }
    if (c.minRating !== undefined &&
        (p.rating === null || p.rating < c.minRating)) {
      return false;
    }
    if (c.openNow === true && p.openNow !== true) {
      return false;
    }
    if (c.cuisine !== undefined &&
        !p.types.map((t) => t.toLowerCase()).includes(c.cuisine.toLowerCase())) {
      return false;
    }
    return true;
  });
}

export interface CuisineOption {
  value: string; // Google place type, e.g. "japanese_restaurant"
  label: string; // e.g. "Japanese"
  count: number;
}

const GENERIC_TYPES = new Set(["restaurant", "fast_food_restaurant"]);

// Cuisines present in this pool, most common first, from Google's
// "<cuisine>_restaurant" place types.
export function cuisineOptions(pool: Restaurant[]): CuisineOption[] {
  const counts = new Map<string, number>();
  for (const p of pool) {
    for (const t of new Set(p.types)) {
      if (!t.endsWith("_restaurant") || GENERIC_TYPES.has(t)) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, label: cuisineLabel(value) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function cuisineLabel(type: string): string {
  const words = type.replace(/_restaurant$/, "").split("_");
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
