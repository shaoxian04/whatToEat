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
    if (c.maxPriceLevel !== undefined &&
        (p.priceLevel === null || p.priceLevel > c.maxPriceLevel)) {
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
