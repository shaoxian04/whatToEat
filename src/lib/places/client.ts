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

// Photo resource names look like "places/{placeId}/photos/{photoId}".
export const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export interface PhotoParams {
  name: string;
  maxWidthPx: number;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

// Resolves a photo resource name to a short-lived public image URL, so the API
// key never reaches the browser.
export async function fetchPhotoUri(params: PhotoParams): Promise<string> {
  if (!PHOTO_NAME_RE.test(params.name)) throw new Error("Invalid photo name");
  const doFetch = params.fetchImpl ?? fetch;
  const url =
    `https://places.googleapis.com/v1/${params.name}/media` +
    `?maxWidthPx=${params.maxWidthPx}&skipHttpRedirect=true`;
  const res = await doFetch(url, { headers: { "X-Goog-Api-Key": params.apiKey } });
  if (!res.ok) throw new Error(`Places photo error: ${res.status}`);
  const data = (await res.json()) as { photoUri?: string };
  if (!data.photoUri) throw new Error("Places photo error: no photoUri");
  return data.photoUri;
}

export interface AreaResult {
  lat: number;
  lng: number;
  label: string;
}

export interface AreaParams {
  query: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

// Turns a typed area/address into coordinates (fallback when location is denied).
export async function searchArea(params: AreaParams): Promise<AreaResult | null> {
  const doFetch = params.fetchImpl ?? fetch;
  const res = await doFetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": params.apiKey,
      "X-Goog-FieldMask": "places.location,places.formattedAddress,places.displayName",
    },
    body: JSON.stringify({ textQuery: params.query, pageSize: 1 }),
  });
  if (!res.ok) throw new Error(`Places text search error: ${res.status}`);
  const data = (await res.json()) as {
    places?: {
      location?: { latitude: number; longitude: number };
      formattedAddress?: string;
      displayName?: { text?: string };
    }[];
  };
  const p = data.places?.[0];
  if (!p?.location) return null;
  return {
    lat: p.location.latitude,
    lng: p.location.longitude,
    label: p.formattedAddress ?? p.displayName?.text ?? params.query,
  };
}
