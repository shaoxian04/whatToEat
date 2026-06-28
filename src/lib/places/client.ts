import type { Restaurant } from "@/lib/decision/types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export function mapPriceLevel(level: string | undefined): number | null {
  if (!level) return null;
  return PRICE_MAP[level] ?? null;
}

export interface NearbyParams {
  lat: number;
  lng: number;
  radiusMeters: number;
  apiKey: string;
  maxResults?: number;
  fetchImpl?: typeof fetch;
}

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  location?: { latitude: number; longitude: number };
  currentOpeningHours?: { openNow?: boolean };
  types?: string[];
  photos?: { name: string }[];
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.location",
  "places.currentOpeningHours.openNow",
  "places.types",
  "places.photos",
].join(",");

export async function fetchNearby(params: NearbyParams): Promise<Restaurant[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const res = await doFetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": params.apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ["restaurant"],
      maxResultCount: params.maxResults ?? 20,
      locationRestriction: {
        circle: {
          center: { latitude: params.lat, longitude: params.lng },
          radius: params.radiusMeters,
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Places API error: ${res.status}`);
  }

  const data = (await res.json()) as { places?: RawPlace[] };
  return (data.places ?? []).map(
    (p): Restaurant => ({
      placeId: p.id,
      name: p.displayName?.text ?? "Unknown",
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? null,
      priceLevel: mapPriceLevel(p.priceLevel),
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
      openNow: p.currentOpeningHours?.openNow ?? null,
      types: p.types ?? [],
      photoRef: p.photos?.[0]?.name ?? null,
    }),
  );
}
