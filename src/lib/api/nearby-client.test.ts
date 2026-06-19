import { describe, it, expect, vi } from "vitest";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";

describe("fetchNearbyRestaurants", () => {
  it("POSTs to /api/nearby and returns the restaurants array", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ restaurants: [{ placeId: "p1" }] }),
    } as Response);

    const out = await fetchNearbyRestaurants(1.3, 103.8, 1000, fetchImpl);
    expect(out).toEqual([{ placeId: "p1" }]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/nearby");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      lat: 1.3, lng: 103.8, radiusMeters: 1000,
    });
  });

  it("throws with the server error message on non-ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Too many requests. Try again shortly." }),
    } as Response);
    await expect(fetchNearbyRestaurants(1, 2, 500, fetchImpl)).rejects.toThrow(
      "Too many requests. Try again shortly.",
    );
  });
});
