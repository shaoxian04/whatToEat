import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/places/client", () => ({
  fetchNearby: vi.fn(),
}));

import { POST } from "@/app/api/nearby/route";
import { fetchNearby } from "@/lib/places/client";

function makeReq(body: unknown, ip = "1.1.1.1"): Request {
  return new Request("http://localhost/api/nearby", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_PLACES_API_KEY = "TEST_KEY";
});

describe("POST /api/nearby", () => {
  it("returns 400 when lat/lng are missing", async () => {
    const res = await POST(makeReq({ radiusMeters: 1000 }));
    expect(res.status).toBe(400);
  });

  it("returns restaurants from fetchNearby on a valid request", async () => {
    vi.mocked(fetchNearby).mockResolvedValue([
      { placeId: "p1", name: "A", rating: 4, priceLevel: 2, lat: 1, lng: 2, openNow: true, types: [], photoRef: null },
    ]);
    const res = await POST(makeReq({ lat: 1.3, lng: 103.8, radiusMeters: 1000 }, "2.2.2.2"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.restaurants).toHaveLength(1);
    expect(vi.mocked(fetchNearby).mock.calls[0][0].apiKey).toBe("TEST_KEY");
  });

  it("returns 500 with a clean message when the upstream throws", async () => {
    vi.mocked(fetchNearby).mockRejectedValue(new Error("Places API error: 429"));
    const res = await POST(makeReq({ lat: 1, lng: 2, radiusMeters: 500 }, "3.3.3.3"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(json.error).not.toContain("429");
    expect(json.error).not.toContain("Places API error");
    expect(json.error).toBe("Could not reach the restaurant service. Please try again.");
  });
});
