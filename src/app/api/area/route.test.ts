import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/places/client", () => ({ searchArea: vi.fn() }));

import { POST, __clearAreaCacheForTests } from "@/app/api/area/route";
import { searchArea } from "@/lib/places/client";

function makeReq(body: unknown, ip = "1.1.1.1"): Request {
  return new Request("http://localhost/api/area", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __clearAreaCacheForTests();
  process.env.GOOGLE_PLACES_API_KEY = "TEST_KEY";
});

describe("POST /api/area", () => {
  it("rejects a missing or too-short query with 400", async () => {
    expect((await POST(makeReq({}))).status).toBe(400);
    expect((await POST(makeReq({ query: "a" }))).status).toBe(400);
  });

  it("returns coordinates for a match and caches by normalised query", async () => {
    vi.mocked(searchArea).mockResolvedValue({ lat: 1, lng: 2, label: "Somewhere" });
    const res = await POST(makeReq({ query: "Somewhere" }, "2.2.2.2"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lat: 1, lng: 2, label: "Somewhere" });
    await POST(makeReq({ query: "somewhere " }, "2.2.2.2"));
    expect(vi.mocked(searchArea)).toHaveBeenCalledTimes(1);
  });

  it("404s when nothing matches", async () => {
    vi.mocked(searchArea).mockResolvedValue(null);
    expect((await POST(makeReq({ query: "nowhere" }, "3.3.3.3"))).status).toBe(404);
  });
});
