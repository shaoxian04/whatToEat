import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/places/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/places/client")>()),
  fetchPhotoUri: vi.fn(),
}));

import { GET, __clearPhotoCacheForTests } from "@/app/api/photo/route";
import { fetchPhotoUri } from "@/lib/places/client";

const req = (name: string) =>
  new Request(`http://localhost/api/photo?name=${encodeURIComponent(name)}`, {
    headers: { "x-forwarded-for": "1.1.1.1" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  __clearPhotoCacheForTests();
  process.env.GOOGLE_PLACES_API_KEY = "TEST_KEY";
});

describe("GET /api/photo", () => {
  it("rejects malformed names with 400", async () => {
    expect((await GET(req("https://evil.example/x"))).status).toBe(400);
    expect(vi.mocked(fetchPhotoUri)).not.toHaveBeenCalled();
  });

  it("redirects to the resolved photo URL and caches it", async () => {
    vi.mocked(fetchPhotoUri).mockResolvedValue("https://lh3.example/p.jpg");
    const res = await GET(req("places/p1/photos/abc"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://lh3.example/p.jpg");
    await GET(req("places/p1/photos/abc"));
    expect(vi.mocked(fetchPhotoUri)).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when the upstream fails", async () => {
    vi.mocked(fetchPhotoUri).mockRejectedValue(new Error("boom"));
    expect((await GET(req("places/p1/photos/zzz"))).status).toBe(502);
  });
});
