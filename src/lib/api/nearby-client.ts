import type { Restaurant } from "@/lib/decision/types";

export async function fetchNearbyRestaurants(
  lat: number,
  lng: number,
  radiusMeters: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Restaurant[]> {
  const res = await fetchImpl("/api/nearby", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, radiusMeters }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load restaurants.");
  }
  return data.restaurants as Restaurant[];
}

export interface AreaCoords {
  lat: number;
  lng: number;
  label: string;
}

export async function searchAreaCoords(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AreaCoords> {
  const res = await fetchImpl("/api/area", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Could not search for that place.");
  }
  return data as AreaCoords;
}
