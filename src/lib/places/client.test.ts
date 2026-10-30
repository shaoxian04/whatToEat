import { describe, it, expect, vi } from "vitest";
import { fetchNearby, mapPriceLevel, fetchPhotoUri, searchArea } from "@/lib/places/client";

const sampleResponse = {
  places: [
    {
      id: "place-1",
      displayName: { text: "Sushi Spot" },
      rating: 4.6,
      priceLevel: "PRICE_LEVEL_MODERATE",
      location: { latitude: 1.3, longitude: 103.8 },
      currentOpeningHours: { openNow: true },
      types: ["restaurant", "sushi_restaurant"],
      photos: [{ name: "places/place-1/photos/abc" }],
    },
  ],
};

describe("mapPriceLevel", () => {
  it("maps enum strings to 1-4 and unknown to null", () => {
    expect(mapPriceLevel("PRICE_LEVEL_INEXPENSIVE")).toBe(1);
    expect(mapPriceLevel("PRICE_LEVEL_MODERATE")).toBe(2);
    expect(mapPriceLevel("PRICE_LEVEL_EXPENSIVE")).toBe(3);
    expect(mapPriceLevel("PRICE_LEVEL_VERY_EXPENSIVE")).toBe(4);
    expect(mapPriceLevel(undefined)).toBeNull();
    expect(mapPriceLevel("PRICE_LEVEL_UNSPECIFIED")).toBeNull();
  });
});

describe("fetchNearby", () => {
  it("posts to the Places API and maps the response to Restaurant[]", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleResponse,
    } as Response);

    const out = await fetchNearby({
      lat: 1.3, lng: 103.8, radiusMeters: 1000, apiKey: "KEY", fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("places:searchNearby");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("KEY");

    expect(out).toEqual([
      {
        placeId: "place-1",
        name: "Sushi Spot",
        rating: 4.6,
        userRatingCount: null,
        priceLevel: 2,
        lat: 1.3,
        lng: 103.8,
        openNow: true,
        types: ["restaurant", "sushi_restaurant"],
        photoRef: "places/place-1/photos/abc",
      },
    ]);
  });

  it("throws a clean error when the API responds non-ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false, status: 429, json: async () => ({}),
    } as Response);
    await expect(
      fetchNearby({ lat: 0, lng: 0, radiusMeters: 500, apiKey: "K", fetchImpl }),
    ).rejects.toThrow("Places API error: 429");
  });

  it("requests userRatingCount in the field mask", async () => {
    let mask = "";
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      mask = (init.headers as Record<string, string>)["X-Goog-FieldMask"];
      return { ok: true, json: async () => ({ places: [] }) };
    }) as unknown as typeof fetch;
    await fetchNearby({ lat: 1, lng: 2, radiusMeters: 1000, apiKey: "k", fetchImpl });
    expect(mask).toContain("places.userRatingCount");
  });

  it("maps userRatingCount from the Places response", async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({
        places: [{ id: "p1", displayName: { text: "P" }, rating: 4.5, userRatingCount: 1234, location: { latitude: 1, longitude: 2 } }],
      }),
    })) as unknown as typeof fetch;
    const [r] = await fetchNearby({ lat: 1, lng: 2, radiusMeters: 1000, apiKey: "k", fetchImpl });
    expect(r.userRatingCount).toBe(1234);
  });
});

describe("fetchPhotoUri", () => {
  it("requests the media endpoint with the key in a header and returns photoUri", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ photoUri: "https://lh3.example/photo" }),
    } as Response);
    const uri = await fetchPhotoUri({ name: "places/p1/photos/abc", maxWidthPx: 400, apiKey: "SECRET", fetchImpl });
    expect(uri).toBe("https://lh3.example/photo");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places/p1/photos/abc/media?maxWidthPx=400&skipHttpRedirect=true");
    expect(url).not.toContain("SECRET");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("SECRET");
  });

  it("rejects malformed photo names without calling upstream", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchPhotoUri({ name: "../../evil", maxWidthPx: 400, apiKey: "K", fetchImpl }),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("searchArea", () => {
  it("returns the first match's coordinates and address", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{ location: { latitude: 3.1, longitude: 101.7 }, formattedAddress: "Bukit Bintang, KL" }],
      }),
    } as Response);
    expect(await searchArea({ query: "bukit bintang", apiKey: "K", fetchImpl }))
      .toEqual({ lat: 3.1, lng: 101.7, label: "Bukit Bintang, KL" });
  });

  it("returns null when nothing matches", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    expect(await searchArea({ query: "zzzz", apiKey: "K", fetchImpl })).toBeNull();
  });
});
