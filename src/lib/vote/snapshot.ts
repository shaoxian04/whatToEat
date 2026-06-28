import type { Restaurant } from "@/lib/decision/types";

export type RestaurantSnapshot = Omit<Restaurant, "types">;

export function toSnapshot(r: Restaurant): RestaurantSnapshot {
  return {
    placeId: r.placeId,
    name: r.name,
    rating: r.rating,
    userRatingCount: r.userRatingCount ?? null,
    priceLevel: r.priceLevel,
    lat: r.lat,
    lng: r.lng,
    openNow: r.openNow,
    photoRef: r.photoRef,
  };
}

export function parseSnapshot(value: unknown): RestaurantSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.placeId !== "string" || typeof v.name !== "string") return null;
  const num = (x: unknown): number | null => (typeof x === "number" ? x : null);
  return {
    placeId: v.placeId,
    name: v.name,
    rating: num(v.rating),
    userRatingCount: num(v.userRatingCount),
    priceLevel: num(v.priceLevel),
    lat: num(v.lat) ?? 0,
    lng: num(v.lng) ?? 0,
    openNow: typeof v.openNow === "boolean" ? v.openNow : null,
    photoRef: typeof v.photoRef === "string" ? v.photoRef : null,
  };
}
