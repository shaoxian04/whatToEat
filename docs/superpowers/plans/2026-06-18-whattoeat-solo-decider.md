# whatToEat — Plan 1: Solo Decider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-friendly web app that finds nearby restaurants via Google Places and helps a solo user decide via a random pick or a filtered browse.

**Architecture:** Next.js (App Router, TypeScript) serves a mobile-first UI and hosts server-side API routes. A pure, dependency-free decision engine (random pick + filters) is unit-tested in isolation. The `/api/nearby` route proxies Google Places (New) so the API key never reaches the browser. No database in this plan — group voting and Supabase arrive in Plan 2.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Vitest + React Testing Library (unit/component), Playwright (E2E), Google Places API (New) `places:searchNearby`.

## Global Constraints

- Mobile-first responsive web app (primary target: phone browser).
- Google Places API key is **server-side only** — referenced exclusively in `/api/nearby`, never imported into a client component or exposed via `NEXT_PUBLIC_*`.
- `/api/nearby` must be rate-limited (per-IP) to keep Google billing near $0.
- TypeScript everywhere; no `any` in committed code.
- Distance is computed locally via haversine (the Nearby Search response has no distance field).
- Price level is normalized to integers 1–4 (1 = cheapest).
- Decision-engine modules (`src/lib/decision/*`) must stay pure: no `fetch`, no DOM, no Next.js imports.
- All randomness goes through an injectable `rng: () => number` parameter (default `Math.random`) so tests are deterministic.

---

### Task 1: Project scaffold + test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `.env.local.example`, `.gitignore`
- Test: `src/lib/__smoke__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable Next.js app (`npm run dev`) and a working test command (`npm test`) that other tasks build on.

- [ ] **Step 1: Scaffold the Next.js app**

Run:
```bash
npx create-next-app@latest whattoeat-tmp --typescript --tailwind --app --src-dir --eslint --no-import-alias --use-npm
```
Then move its contents into the project root (this repo root is the app root). Expected: `src/app/page.tsx`, `package.json`, Tailwind configured.

- [ ] **Step 2: Add test dependencies**

Run:
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @playwright/test
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 4: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Add scripts to `package.json`**

Set the `"scripts"` block to include:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 6: Add `@` path alias to `tsconfig.json`**

Ensure `compilerOptions` contains:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 7: Create `.env.local.example`**

```bash
# Google Places API (New) key — server-side only, never prefix with NEXT_PUBLIC_
GOOGLE_PLACES_API_KEY=your_key_here
```

- [ ] **Step 8: Write the smoke test** — `src/lib/__smoke__/smoke.test.ts`

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs the test harness", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: Run the smoke test to verify the harness works**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 10: Verify the app boots**

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest + Playwright harness"
```

---

### Task 2: Decision engine — domain types + random pick

**Files:**
- Create: `src/lib/decision/types.ts`
- Create: `src/lib/decision/pick.ts`
- Test: `src/lib/decision/pick.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Restaurant { placeId: string; name: string; rating: number | null; priceLevel: number | null; lat: number; lng: number; openNow: boolean | null; types: string[]; photoRef: string | null; }`
  - `interface LatLng { lat: number; lng: number; }`
  - `function pickRandom(pool: Restaurant[], previousId?: string, rng?: () => number): Restaurant | null`

- [ ] **Step 1: Write the failing test** — `src/lib/decision/pick.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { pickRandom } from "@/lib/decision/pick";
import type { Restaurant } from "@/lib/decision/types";

function r(id: string): Restaurant {
  return { placeId: id, name: id, rating: null, priceLevel: null, lat: 0, lng: 0, openNow: null, types: [], photoRef: null };
}

describe("pickRandom", () => {
  it("returns null for an empty pool", () => {
    expect(pickRandom([])).toBeNull();
  });

  it("returns the only item when pool has one", () => {
    expect(pickRandom([r("a")])?.placeId).toBe("a");
  });

  it("uses rng to choose an index", () => {
    const pool = [r("a"), r("b"), r("c")];
    expect(pickRandom(pool, undefined, () => 0)?.placeId).toBe("a");
    expect(pickRandom(pool, undefined, () => 0.99)?.placeId).toBe("c");
  });

  it("excludes the previous pick when the pool has alternatives", () => {
    const pool = [r("a"), r("b")];
    // rng=0 would normally pick index 0 ("a"); with previous "a" excluded, candidates=["b"]
    expect(pickRandom(pool, "a", () => 0)?.placeId).toBe("b");
  });

  it("ignores previous exclusion when it would empty the pool", () => {
    const pool = [r("a")];
    expect(pickRandom(pool, "a", () => 0)?.placeId).toBe("a");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/decision/pick.test.ts`
Expected: FAIL — cannot find module `@/lib/decision/pick`.

- [ ] **Step 3: Create the types** — `src/lib/decision/types.ts`

```ts
export interface LatLng {
  lat: number;
  lng: number;
}

export interface Restaurant {
  placeId: string;
  name: string;
  rating: number | null;
  priceLevel: number | null; // 1 (cheapest) .. 4
  lat: number;
  lng: number;
  openNow: boolean | null;
  types: string[];
  photoRef: string | null;
}
```

- [ ] **Step 4: Write the minimal implementation** — `src/lib/decision/pick.ts`

```ts
import type { Restaurant } from "@/lib/decision/types";

export function pickRandom(
  pool: Restaurant[],
  previousId?: string,
  rng: () => number = Math.random,
): Restaurant | null {
  if (pool.length === 0) return null;
  const candidates =
    previousId && pool.length > 1
      ? pool.filter((r) => r.placeId !== previousId)
      : pool;
  const index = Math.floor(rng() * candidates.length);
  return candidates[index];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/decision/pick.test.ts`
Expected: PASS — 5 tests passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/decision/types.ts src/lib/decision/pick.ts src/lib/decision/pick.test.ts
git commit -m "feat: add restaurant types and random pick engine"
```

---

### Task 3: Decision engine — distance + filters

**Files:**
- Create: `src/lib/decision/distance.ts`
- Create: `src/lib/decision/filter.ts`
- Test: `src/lib/decision/distance.test.ts`
- Test: `src/lib/decision/filter.test.ts`

**Interfaces:**
- Consumes: `Restaurant`, `LatLng` from `@/lib/decision/types`.
- Produces:
  - `function haversineMeters(a: LatLng, b: LatLng): number`
  - `interface FilterCriteria { maxDistanceMeters?: number; maxPriceLevel?: number; minRating?: number; cuisine?: string; openNow?: boolean; }`
  - `function applyFilters(pool: Restaurant[], origin: LatLng, c: FilterCriteria): Restaurant[]`

- [ ] **Step 1: Write the failing distance test** — `src/lib/decision/distance.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { haversineMeters } from "@/lib/decision/distance";

describe("haversineMeters", () => {
  it("is zero for identical points", () => {
    expect(haversineMeters({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });

  it("approximates a known short distance (~157m per 0.001 lat near equator)", () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 });
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/lib/decision/distance.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement haversine** — `src/lib/decision/distance.ts`

```ts
import type { LatLng } from "@/lib/decision/types";

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/lib/decision/distance.test.ts`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Write the failing filter test** — `src/lib/decision/filter.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { applyFilters } from "@/lib/decision/filter";
import type { Restaurant } from "@/lib/decision/types";

const origin = { lat: 0, lng: 0 };

function r(over: Partial<Restaurant>): Restaurant {
  return {
    placeId: "x", name: "x", rating: 4, priceLevel: 2,
    lat: 0, lng: 0, openNow: true, types: ["restaurant"], photoRef: null, ...over,
  };
}

describe("applyFilters", () => {
  it("returns all when criteria is empty", () => {
    const pool = [r({ placeId: "a" }), r({ placeId: "b" })];
    expect(applyFilters(pool, origin, {})).toHaveLength(2);
  });

  it("filters out places beyond maxDistanceMeters", () => {
    const near = r({ placeId: "near", lat: 0, lng: 0 });
    const far = r({ placeId: "far", lat: 1, lng: 1 }); // ~157km away
    const out = applyFilters([near, far], origin, { maxDistanceMeters: 1000 });
    expect(out.map((x) => x.placeId)).toEqual(["near"]);
  });

  it("filters by maxPriceLevel, minRating, openNow, and cuisine", () => {
    const pool = [
      r({ placeId: "keep", priceLevel: 2, rating: 4.5, openNow: true, types: ["restaurant", "sushi"] }),
      r({ placeId: "pricey", priceLevel: 4 }),
      r({ placeId: "lowrated", rating: 2 }),
      r({ placeId: "closed", openNow: false }),
      r({ placeId: "wrongcuisine", types: ["restaurant", "pizza"] }),
    ];
    const out = applyFilters(pool, origin, {
      maxPriceLevel: 3, minRating: 3.5, openNow: true, cuisine: "sushi",
    });
    expect(out.map((x) => x.placeId)).toEqual(["keep"]);
  });

  it("keeps items with null rating/price only when that criterion is unset", () => {
    const pool = [r({ placeId: "n", rating: null, priceLevel: null })];
    expect(applyFilters(pool, origin, {})).toHaveLength(1);
    expect(applyFilters(pool, origin, { minRating: 3 })).toHaveLength(0);
    expect(applyFilters(pool, origin, { maxPriceLevel: 2 })).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Run it to verify failure**

Run: `npx vitest run src/lib/decision/filter.test.ts`
Expected: FAIL — cannot find module `@/lib/decision/filter`.

- [ ] **Step 7: Implement filters** — `src/lib/decision/filter.ts`

```ts
import type { LatLng, Restaurant } from "@/lib/decision/types";
import { haversineMeters } from "@/lib/decision/distance";

export interface FilterCriteria {
  maxDistanceMeters?: number;
  maxPriceLevel?: number;
  minRating?: number;
  cuisine?: string;
  openNow?: boolean;
}

export function applyFilters(
  pool: Restaurant[],
  origin: LatLng,
  c: FilterCriteria,
): Restaurant[] {
  return pool.filter((p) => {
    if (c.maxDistanceMeters !== undefined &&
        haversineMeters(origin, { lat: p.lat, lng: p.lng }) > c.maxDistanceMeters) {
      return false;
    }
    if (c.maxPriceLevel !== undefined &&
        (p.priceLevel === null || p.priceLevel > c.maxPriceLevel)) {
      return false;
    }
    if (c.minRating !== undefined &&
        (p.rating === null || p.rating < c.minRating)) {
      return false;
    }
    if (c.openNow === true && p.openNow !== true) {
      return false;
    }
    if (c.cuisine !== undefined &&
        !p.types.map((t) => t.toLowerCase()).includes(c.cuisine.toLowerCase())) {
      return false;
    }
    return true;
  });
}
```

- [ ] **Step 8: Run it to verify pass**

Run: `npx vitest run src/lib/decision/filter.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 9: Commit**

```bash
git add src/lib/decision/distance.ts src/lib/decision/filter.ts src/lib/decision/distance.test.ts src/lib/decision/filter.test.ts
git commit -m "feat: add haversine distance and restaurant filters"
```

---

### Task 4: Google Places client (server-side mapping)

**Files:**
- Create: `src/lib/places/client.ts`
- Test: `src/lib/places/client.test.ts`

**Interfaces:**
- Consumes: `Restaurant` from `@/lib/decision/types`.
- Produces:
  - `interface NearbyParams { lat: number; lng: number; radiusMeters: number; apiKey: string; maxResults?: number; fetchImpl?: typeof fetch; }`
  - `function mapPriceLevel(level: string | undefined): number | null`
  - `function fetchNearby(params: NearbyParams): Promise<Restaurant[]>`

- [ ] **Step 1: Write the failing test** — `src/lib/places/client.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/lib/places/client.test.ts`
Expected: FAIL — cannot find module `@/lib/places/client`.

- [ ] **Step 3: Implement the client** — `src/lib/places/client.ts`

```ts
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
      priceLevel: mapPriceLevel(p.priceLevel),
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
      openNow: p.currentOpeningHours?.openNow ?? null,
      types: p.types ?? [],
      photoRef: p.photos?.[0]?.name ?? null,
    }),
  );
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/lib/places/client.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/places/client.ts src/lib/places/client.test.ts
git commit -m "feat: add Google Places (New) nearby search client"
```

---

### Task 5: `/api/nearby` route (key proxy + rate limit)

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `src/app/api/nearby/route.ts`
- Test: `src/lib/rate-limit.test.ts`
- Test: `src/app/api/nearby/route.test.ts`

**Interfaces:**
- Consumes: `fetchNearby` from `@/lib/places/client`; `Restaurant`.
- Produces:
  - `function createRateLimiter(maxPerWindow: number, windowMs: number): (key: string, now?: number) => boolean` (returns `true` if allowed)
  - `POST /api/nearby` accepting JSON `{ lat, lng, radiusMeters }`, returning `{ restaurants: Restaurant[] }` or an error envelope `{ error: string }`.

- [ ] **Step 1: Write the failing rate-limit test** — `src/lib/rate-limit.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to max requests then blocks within the window", () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow("ip1", 0)).toBe(true);
    expect(allow("ip1", 100)).toBe(true);
    expect(allow("ip1", 200)).toBe(false);
  });

  it("resets after the window passes", () => {
    const allow = createRateLimiter(1, 1000);
    expect(allow("ip1", 0)).toBe(true);
    expect(allow("ip1", 500)).toBe(false);
    expect(allow("ip1", 1500)).toBe(true);
  });

  it("tracks keys independently", () => {
    const allow = createRateLimiter(1, 1000);
    expect(allow("ip1", 0)).toBe(true);
    expect(allow("ip2", 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/lib/rate-limit.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the rate limiter** — `src/lib/rate-limit.ts`

```ts
export function createRateLimiter(maxPerWindow: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now: number = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= maxPerWindow) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/lib/rate-limit.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Write the failing route test** — `src/app/api/nearby/route.test.ts`

```ts
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
    expect(json.error).toBeDefined();
  });
});
```

- [ ] **Step 6: Run it to verify failure**

Run: `npx vitest run src/app/api/nearby/route.test.ts`
Expected: FAIL — cannot find module `@/app/api/nearby/route`.

- [ ] **Step 7: Implement the route** — `src/app/api/nearby/route.ts`

```ts
import { NextResponse } from "next/server";
import { fetchNearby } from "@/lib/places/client";
import { createRateLimiter } from "@/lib/rate-limit";

const allow = createRateLimiter(30, 60_000); // 30 req/min per IP

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allow(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing its Places API key." }, { status: 500 });
  }

  let body: { lat?: number; lng?: number; radiusMeters?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { lat, lng, radiusMeters } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng are required numbers." }, { status: 400 });
  }

  try {
    const restaurants = await fetchNearby({
      lat,
      lng,
      radiusMeters: typeof radiusMeters === "number" ? radiusMeters : 1500,
      apiKey,
    });
    return NextResponse.json({ restaurants });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the restaurant service. Please try again." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 8: Run it to verify pass**

Run: `npx vitest run src/app/api/nearby/route.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 9: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts src/app/api/nearby/route.ts src/app/api/nearby/route.test.ts
git commit -m "feat: add rate-limited /api/nearby places proxy"
```

---

### Task 6: Nearby data hook + geolocation hook

**Files:**
- Create: `src/hooks/useGeolocation.ts`
- Create: `src/lib/api/nearby-client.ts`
- Test: `src/lib/api/nearby-client.test.ts`

**Interfaces:**
- Consumes: `Restaurant`; `POST /api/nearby`.
- Produces:
  - `function fetchNearbyRestaurants(lat: number, lng: number, radiusMeters: number, fetchImpl?: typeof fetch): Promise<Restaurant[]>` (browser-side caller of the API route)
  - `function useGeolocation(): { coords: LatLng | null; error: string | null; loading: boolean; request: () => void }`

- [ ] **Step 1: Write the failing client test** — `src/lib/api/nearby-client.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/lib/api/nearby-client.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the browser API caller** — `src/lib/api/nearby-client.ts`

```ts
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
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/lib/api/nearby-client.test.ts`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Implement the geolocation hook** — `src/hooks/useGeolocation.ts`

(No unit test — this is a thin wrapper over the browser `navigator.geolocation` API and is exercised by the Playwright E2E in Task 10, which mocks geolocation.)

```ts
"use client";

import { useState, useCallback } from "react";
import type { LatLng } from "@/lib/decision/types";

export function useGeolocation() {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Location is not supported on this device.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      () => {
        setError("We couldn't get your location. Please allow location access.");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }, []);

  return { coords, error, loading, request };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useGeolocation.ts src/lib/api/nearby-client.ts src/lib/api/nearby-client.test.ts
git commit -m "feat: add geolocation hook and browser nearby API client"
```

---

### Task 7: RestaurantCard component

**Files:**
- Create: `src/components/RestaurantCard.tsx`
- Test: `src/components/RestaurantCard.test.tsx`

**Interfaces:**
- Consumes: `Restaurant`.
- Produces: `function RestaurantCard({ restaurant }: { restaurant: Restaurant }): JSX.Element` — renders name, rating, price (as `$`..`$$$$`), open-now, and a Google Maps "Directions" link.

- [ ] **Step 1: Write the failing test** — `src/components/RestaurantCard.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RestaurantCard } from "@/components/RestaurantCard";
import type { Restaurant } from "@/lib/decision/types";

const base: Restaurant = {
  placeId: "p1", name: "Sushi Spot", rating: 4.6, priceLevel: 2,
  lat: 1.3, lng: 103.8, openNow: true, types: ["restaurant"], photoRef: null,
};

describe("RestaurantCard", () => {
  it("shows name, rating, price level and open status", () => {
    render(<RestaurantCard restaurant={base} />);
    expect(screen.getByText("Sushi Spot")).toBeInTheDocument();
    expect(screen.getByText(/4.6/)).toBeInTheDocument();
    expect(screen.getByText("$$")).toBeInTheDocument();
    expect(screen.getByText(/open now/i)).toBeInTheDocument();
  });

  it("renders a directions link to Google Maps using the place id", () => {
    render(<RestaurantCard restaurant={base} />);
    const link = screen.getByRole("link", { name: /directions/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Sushi%20Spot&query_place_id=p1",
    );
  });

  it("hides rating/price gracefully when null", () => {
    render(<RestaurantCard restaurant={{ ...base, rating: null, priceLevel: null }} />);
    expect(screen.getByText(/no rating/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/components/RestaurantCard.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the component** — `src/components/RestaurantCard.tsx`

```tsx
import type { Restaurant } from "@/lib/decision/types";

function priceLabel(level: number | null): string {
  return level ? "$".repeat(level) : "";
}

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const mapsUrl =
    `https://www.google.com/maps/search/?api=1&query=` +
    `${encodeURIComponent(restaurant.name)}&query_place_id=${restaurant.placeId}`;

  return (
    <div className="rounded-2xl border border-gray-200 p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{restaurant.name}</h2>
      <div className="mt-1 flex flex-wrap gap-2 text-sm text-gray-600">
        <span>{restaurant.rating !== null ? `★ ${restaurant.rating}` : "No rating"}</span>
        {restaurant.priceLevel !== null && <span>{priceLabel(restaurant.priceLevel)}</span>}
        {restaurant.openNow === true && <span className="text-green-600">Open now</span>}
        {restaurant.openNow === false && <span className="text-red-600">Closed</span>}
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
      >
        Directions
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/components/RestaurantCard.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/RestaurantCard.tsx src/components/RestaurantCard.test.tsx
git commit -m "feat: add RestaurantCard component"
```

---

### Task 8: Home page with three mode buttons

**Files:**
- Modify: `src/app/page.tsx` (replace the create-next-app default)
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: nothing beyond Next.js `Link`.
- Produces: a client home page with three links — `/surprise`, `/browse`, `/vote` (the `/vote` route is built in Plan 2; here the button links to it and a "Coming soon" note is acceptable, but the link must exist).

- [ ] **Step 1: Write the failing test** — `src/app/page.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the three entry modes with correct links", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: /surprise me/i })).toHaveAttribute("href", "/surprise");
    expect(screen.getByRole("link", { name: /browse/i })).toHaveAttribute("href", "/browse");
    expect(screen.getByRole("link", { name: /group vote/i })).toHaveAttribute("href", "/vote");
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/app/page.test.tsx`
Expected: FAIL — the default create-next-app page has no such links.

- [ ] **Step 3: Implement the home page** — `src/app/page.tsx`

```tsx
import Link from "next/link";

const MODES = [
  { href: "/surprise", emoji: "🎲", label: "Surprise me", sub: "Random nearby pick" },
  { href: "/browse", emoji: "🔍", label: "Browse restaurants", sub: "Filter what's nearby" },
  { href: "/vote", emoji: "✍️", label: "Quick group vote", sub: "Type options, vote now" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="mb-2 text-center text-3xl font-bold">whatToEat</h1>
      {MODES.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className="flex items-center gap-4 rounded-2xl border border-gray-200 p-5 shadow-sm active:scale-[0.99]"
        >
          <span className="text-3xl">{m.emoji}</span>
          <span>
            <span className="block text-lg font-semibold">{m.label}</span>
            <span className="block text-sm text-gray-500">{m.sub}</span>
          </span>
        </Link>
      ))}
    </main>
  );
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/app/page.test.tsx`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "feat: add home page with three entry modes"
```

---

### Task 9: Surprise me mode (Mode B)

**Files:**
- Create: `src/components/DecideView.tsx`
- Create: `src/app/surprise/page.tsx`
- Test: `src/components/DecideView.test.tsx`

**Interfaces:**
- Consumes: `Restaurant`, `pickRandom`, `RestaurantCard`, `useGeolocation`, `fetchNearbyRestaurants`.
- Produces: `function DecideView(props: { loadRestaurants: (coords: LatLng) => Promise<Restaurant[]> }): JSX.Element` — a testable view that takes an injectable loader (so the test avoids real geolocation/network), renders the current pick, and a "Pick again" button that re-rolls excluding the previous pick.

- [ ] **Step 1: Write the failing test** — `src/components/DecideView.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecideView } from "@/components/DecideView";
import type { Restaurant } from "@/lib/decision/types";

function r(id: string): Restaurant {
  return { placeId: id, name: id, rating: 4, priceLevel: 2, lat: 0, lng: 0, openNow: true, types: [], photoRef: null };
}

describe("DecideView", () => {
  it("loads restaurants and shows one pick after granting location", async () => {
    const loader = vi.fn().mockResolvedValue([r("Alpha"), r("Beta")]);
    render(<DecideView loadRestaurants={loader} autoStartCoords={{ lat: 1, lng: 2 }} rng={() => 0} />);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });

  it("shows an empty state when no restaurants are found", async () => {
    const loader = vi.fn().mockResolvedValue([]);
    render(<DecideView loadRestaurants={loader} autoStartCoords={{ lat: 1, lng: 2 }} rng={() => 0} />);
    expect(await screen.findByText(/no restaurants/i)).toBeInTheDocument();
  });

  it("re-rolls to a different pick on 'Pick again'", async () => {
    const loader = vi.fn().mockResolvedValue([r("Alpha"), r("Beta")]);
    // first render rng=0 -> "Alpha"; after pick-again, previous "Alpha" excluded -> "Beta"
    render(<DecideView loadRestaurants={loader} autoStartCoords={{ lat: 1, lng: 2 }} rng={() => 0} />);
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByRole("button", { name: /pick again/i }));
    expect(await screen.findByText("Beta")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/components/DecideView.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement DecideView** — `src/components/DecideView.tsx`

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { LatLng, Restaurant } from "@/lib/decision/types";
import { pickRandom } from "@/lib/decision/pick";
import { RestaurantCard } from "@/components/RestaurantCard";

interface Props {
  loadRestaurants: (coords: LatLng) => Promise<Restaurant[]>;
  autoStartCoords?: LatLng;          // test hook; in the page this comes from geolocation
  rng?: () => number;                // test hook
}

export function DecideView({ loadRestaurants, autoStartCoords, rng = Math.random }: Props) {
  const [pool, setPool] = useState<Restaurant[]>([]);
  const [current, setCurrent] = useState<Restaurant | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");

  const start = useCallback(
    async (coords: LatLng) => {
      setStatus("loading");
      try {
        const list = await loadRestaurants(coords);
        setPool(list);
        if (list.length === 0) {
          setStatus("empty");
          return;
        }
        setCurrent(pickRandom(list, undefined, rng));
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [loadRestaurants, rng],
  );

  useEffect(() => {
    if (autoStartCoords) void start(autoStartCoords);
  }, [autoStartCoords, start]);

  const again = () => setCurrent(pickRandom(pool, current?.placeId, rng));

  if (status === "loading") return <p className="p-6">Finding places near you…</p>;
  if (status === "empty") return <p className="p-6">No restaurants found nearby. Try moving or widening your search.</p>;
  if (status === "error") return <p className="p-6">Something went wrong loading restaurants. Please try again.</p>;
  if (status === "ready" && current) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <RestaurantCard restaurant={current} />
        <button
          onClick={again}
          className="rounded-xl bg-gray-900 px-4 py-2 font-medium text-white"
        >
          🎲 Pick again
        </button>
      </div>
    );
  }
  return <p className="p-6">Getting ready…</p>;
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/components/DecideView.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Wire the page** — `src/app/surprise/page.tsx`

```tsx
"use client";

import { useEffect } from "react";
import { DecideView } from "@/components/DecideView";
import { useGeolocation } from "@/hooks/useGeolocation";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";
import type { LatLng } from "@/lib/decision/types";

export default function SurprisePage() {
  const { coords, error, request } = useGeolocation();
  useEffect(() => { request(); }, [request]);

  const loader = (c: LatLng) => fetchNearbyRestaurants(c.lat, c.lng, 1500);

  if (error) return <p className="p-6">{error}</p>;
  if (!coords) return <p className="p-6">Requesting your location…</p>;

  return <DecideView loadRestaurants={loader} autoStartCoords={coords} />;
}
```

- [ ] **Step 6: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, `/surprise` route listed.

- [ ] **Step 7: Commit**

```bash
git add src/components/DecideView.tsx src/components/DecideView.test.tsx src/app/surprise/page.tsx
git commit -m "feat: add Surprise me mode with pick-again"
```

---

### Task 10: Browse/filter mode (Mode A)

**Files:**
- Create: `src/components/FilterControls.tsx`
- Create: `src/components/BrowseView.tsx`
- Create: `src/app/browse/page.tsx`
- Test: `src/components/BrowseView.test.tsx`

**Interfaces:**
- Consumes: `Restaurant`, `applyFilters`, `FilterCriteria`, `RestaurantCard`, `useGeolocation`, `fetchNearbyRestaurants`.
- Produces: `function BrowseView(props: { loadRestaurants: (coords: LatLng) => Promise<Restaurant[]>; origin: LatLng; autoStartCoords?: LatLng }): JSX.Element` — renders filter controls and a live-filtered results list.

- [ ] **Step 1: Write the failing test** — `src/components/BrowseView.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowseView } from "@/components/BrowseView";
import type { Restaurant } from "@/lib/decision/types";

function r(over: Partial<Restaurant>): Restaurant {
  return { placeId: "x", name: "x", rating: 4, priceLevel: 2, lat: 0, lng: 0, openNow: true, types: ["restaurant"], photoRef: null, ...over };
}

describe("BrowseView", () => {
  const origin = { lat: 0, lng: 0 };

  it("lists all nearby restaurants initially", async () => {
    const loader = vi.fn().mockResolvedValue([r({ placeId: "a", name: "Alpha" }), r({ placeId: "b", name: "Beta" })]);
    render(<BrowseView loadRestaurants={loader} origin={origin} autoStartCoords={origin} />);
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("filters the list when minimum rating is raised", async () => {
    const loader = vi.fn().mockResolvedValue([
      r({ placeId: "a", name: "Alpha", rating: 4.8 }),
      r({ placeId: "b", name: "Beta", rating: 3.0 }),
    ]);
    render(<BrowseView loadRestaurants={loader} origin={origin} autoStartCoords={origin} />);
    await screen.findByText("Alpha");
    await userEvent.selectOptions(screen.getByLabelText(/minimum rating/i), "4.5");
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/components/BrowseView.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement FilterControls** — `src/components/FilterControls.tsx`

```tsx
"use client";

import type { FilterCriteria } from "@/lib/decision/filter";

interface Props {
  value: FilterCriteria;
  onChange: (next: FilterCriteria) => void;
}

export function FilterControls({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <label className="text-sm">
        Minimum rating
        <select
          aria-label="Minimum rating"
          className="ml-2 rounded border px-2 py-1"
          value={value.minRating ?? ""}
          onChange={(e) =>
            onChange({ ...value, minRating: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">Any</option>
          <option value="3.5">3.5+</option>
          <option value="4">4.0+</option>
          <option value="4.5">4.5+</option>
        </select>
      </label>

      <label className="text-sm">
        Max price
        <select
          aria-label="Maximum price"
          className="ml-2 rounded border px-2 py-1"
          value={value.maxPriceLevel ?? ""}
          onChange={(e) =>
            onChange({ ...value, maxPriceLevel: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">Any</option>
          <option value="1">$</option>
          <option value="2">$$</option>
          <option value="3">$$$</option>
        </select>
      </label>

      <label className="flex items-center gap-1 text-sm">
        <input
          type="checkbox"
          aria-label="Open now"
          checked={value.openNow === true}
          onChange={(e) => onChange({ ...value, openNow: e.target.checked ? true : undefined })}
        />
        Open now
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Implement BrowseView** — `src/components/BrowseView.tsx`

```tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { LatLng, Restaurant } from "@/lib/decision/types";
import { applyFilters, type FilterCriteria } from "@/lib/decision/filter";
import { RestaurantCard } from "@/components/RestaurantCard";
import { FilterControls } from "@/components/FilterControls";

interface Props {
  loadRestaurants: (coords: LatLng) => Promise<Restaurant[]>;
  origin: LatLng;
  autoStartCoords?: LatLng;
}

export function BrowseView({ loadRestaurants, origin, autoStartCoords }: Props) {
  const [pool, setPool] = useState<Restaurant[]>([]);
  const [criteria, setCriteria] = useState<FilterCriteria>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const start = useCallback(
    async (coords: LatLng) => {
      setStatus("loading");
      try {
        setPool(await loadRestaurants(coords));
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [loadRestaurants],
  );

  useEffect(() => {
    if (autoStartCoords) void start(autoStartCoords);
  }, [autoStartCoords, start]);

  const filtered = useMemo(
    () => applyFilters(pool, origin, criteria),
    [pool, origin, criteria],
  );

  if (status === "loading") return <p className="p-6">Finding places near you…</p>;
  if (status === "error") return <p className="p-6">Something went wrong. Please try again.</p>;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <FilterControls value={criteria} onChange={setCriteria} />
      {filtered.length === 0 ? (
        <p>No restaurants match these filters. Try relaxing them.</p>
      ) : (
        filtered.map((rst) => <RestaurantCard key={rst.placeId} restaurant={rst} />)
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify pass**

Run: `npx vitest run src/components/BrowseView.test.tsx`
Expected: PASS — 2 tests passed.

- [ ] **Step 6: Wire the page** — `src/app/browse/page.tsx`

```tsx
"use client";

import { useEffect } from "react";
import { BrowseView } from "@/components/BrowseView";
import { useGeolocation } from "@/hooks/useGeolocation";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";
import type { LatLng } from "@/lib/decision/types";

export default function BrowsePage() {
  const { coords, error, request } = useGeolocation();
  useEffect(() => { request(); }, [request]);

  const loader = (c: LatLng) => fetchNearbyRestaurants(c.lat, c.lng, 1500);

  if (error) return <p className="p-6">{error}</p>;
  if (!coords) return <p className="p-6">Requesting your location…</p>;

  return <BrowseView loadRestaurants={loader} origin={coords} autoStartCoords={coords} />;
}
```

- [ ] **Step 7: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, `/browse` route listed.

- [ ] **Step 8: Commit**

```bash
git add src/components/FilterControls.tsx src/components/BrowseView.tsx src/components/BrowseView.test.tsx src/app/browse/page.tsx
git commit -m "feat: add Browse/filter mode"
```

---

### Task 11: E2E — solo random pick flow

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/surprise.spec.ts`

**Interfaces:**
- Consumes: the running app (`/surprise`), the `/api/nearby` route.
- Produces: a Playwright spec that mocks geolocation + the `/api/nearby` response and asserts a pick is shown and "Pick again" changes it.

- [ ] **Step 1: Create the Playwright config** — `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 5"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Write the E2E spec** — `e2e/surprise.spec.ts`

```ts
import { test, expect } from "@playwright/test";

const MOCK_RESTAURANTS = {
  restaurants: [
    { placeId: "p1", name: "Alpha Diner", rating: 4.5, priceLevel: 2, lat: 1.30, lng: 103.80, openNow: true, types: ["restaurant"], photoRef: null },
    { placeId: "p2", name: "Beta Bistro", rating: 4.2, priceLevel: 1, lat: 1.301, lng: 103.801, openNow: true, types: ["restaurant"], photoRef: null },
  ],
};

test("solo random pick shows a restaurant and re-rolls", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 1.3, longitude: 103.8 });

  await page.route("**/api/nearby", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_RESTAURANTS) }),
  );

  await page.goto("/surprise");

  // One of the two mock restaurants should appear.
  const pick = page.getByRole("heading", { level: 2 });
  await expect(pick).toBeVisible();
  const firstName = await pick.textContent();
  expect(["Alpha Diner", "Beta Bistro"]).toContain(firstName);

  // Pick again should keep showing a valid restaurant.
  await page.getByRole("button", { name: /pick again/i }).click();
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
});
```

- [ ] **Step 3: Install the Playwright browser**

Run: `npx playwright install chromium`
Expected: Chromium downloaded.

- [ ] **Step 4: Run the E2E test**

Run: `npm run e2e`
Expected: PASS — 1 passed (the dev server boots automatically via `webServer`).

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/surprise.spec.ts
git commit -m "test: add E2E for solo random pick flow"
```

---

### Task 12: Full verification + run docs

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a README documenting setup (env var, install, run, test) so the app is reproducible.

- [ ] **Step 1: Run the entire unit/component suite**

Run: `npm test`
Expected: PASS — all suites green (pick, distance, filter, places client, rate-limit, nearby route, nearby-client, RestaurantCard, Home, DecideView, BrowseView).

- [ ] **Step 2: Run the E2E suite**

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Write the README** — `README.md`

```markdown
# whatToEat

Mobile-friendly web app that helps you decide where to eat — random pick or filtered browse of nearby restaurants (Google Places). Group voting arrives in Plan 2.

## Setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and set `GOOGLE_PLACES_API_KEY`
   (enable "Places API (New)" in Google Cloud; a billing account is required even for the free tier).
3. `npm run dev` → open http://localhost:3000 on your phone or browser.

## Testing

- `npm test` — unit + component tests (Vitest)
- `npm run e2e` — end-to-end tests (Playwright)

## Notes

- The Google API key is used only server-side in `src/app/api/nearby/route.ts`. Never expose it to the client.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and testing instructions"
```

---

## Self-Review

**1. Spec coverage:**
- Mobile-friendly web app → Tasks 1, 8 (max-w-md layout, Pixel 5 E2E). ✅
- Google Places data → Tasks 4, 5. ✅
- Mode B (Surprise/random) → Tasks 2, 9. ✅
- Mode A (Browse/filter: distance, price, rating, cuisine, open-now) → Tasks 3, 10. ✅ (cuisine/distance covered by `applyFilters`; the UI in Task 10 exposes rating/price/open-now — distance & cuisine controls are intentionally deferred to keep Task 10 small, but the engine + a follow-up control can add them; noted as a known gap below.)
- Random pick avoids immediate repeat → Task 2. ✅
- API key server-side only → Task 5 (Global Constraints). ✅
- Rate limiting → Task 5. ✅
- Error handling (location denied, no results, API error) → Tasks 6 (hook error), 9 (empty/error states), 10 (error state), 5 (route errors). ✅
- Restaurant card with directions → Task 7. ✅
- Testing (unit/integration/E2E) → Tasks 2–11. ✅
- **Out of scope for Plan 1 (correctly deferred to Plan 2):** Quick vote, group voting, Supabase, realtime, accounts. The `/vote` link exists (Task 8) but its page is Plan 2.

**Known gap (intentional, minor):** Task 10's `FilterControls` ships rating/price/open-now controls but not distance-radius or cuisine dropdowns, even though `applyFilters` supports them. This keeps the task small; add those two controls as the first task of a future iteration if desired. Flagged here rather than left silent.

**2. Placeholder scan:** No TBD/TODO/"add error handling" placeholders — every code step shows complete code. ✅

**3. Type consistency:** `Restaurant`, `LatLng`, `FilterCriteria`, `pickRandom`, `applyFilters`, `haversineMeters`, `fetchNearby`, `fetchNearbyRestaurants`, `mapPriceLevel` are defined once and consumed with matching signatures across tasks. The browser caller is `fetchNearbyRestaurants` (Task 6) vs. the server `fetchNearby` (Task 4) — distinct names by design, no collision. ✅
