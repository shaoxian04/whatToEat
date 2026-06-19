import { describe, it, expect, vi } from "vitest";
import { fetchNearby, mapPriceLevel } from "@/lib/places/client";

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
});
