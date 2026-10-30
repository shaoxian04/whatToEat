# Smart Recommendation Engine (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw Google `rating` with a smarter objective score (review-count-weighted) that orders Browse, weights the Surprise pick, and seeds group votes with the best nearby spots.

**Architecture:** One new pure module `src/lib/decision/score.ts` computes a Bayesian-adjusted rating plus a weighted composite score (rating + distance + open-now). Three thin UI integrations consume it. `userRatingCount` is added to the `Restaurant` model (optional/nullable so existing fixtures keep compiling) and fetched from the Places API.

**Tech Stack:** Next.js 16 (App Router), TypeScript (strict), Tailwind v4, Vitest (unit/component), Playwright (e2e), Google Places API (New).

## Global Constraints

- **Weights (named constants, exact):** rating `0.6`, distance `0.3`, openNow `0.1`, price `0.0`.
- **Scoring constants:** `bayesMinCount` (m) `= 50`; `priorMeanFallback` (C fallback) `= 3.8`; `maxDistanceMeters` default `= 5000`.
- **`userRatingCount` is optional-nullable** (`userRatingCount?: number | null`) — do NOT make it required; that would force edits to 13 unrelated fixture files. Existing `Restaurant` literals must keep compiling untouched.
- **`npx tsc --noEmit` must stay clean** after every task.
- **Immutability:** no in-place mutation; return new arrays/objects (sort on a copy if needed — `Array.prototype.sort` on a fresh `.map()` result is fine).
- **No accounts / no storage / Google-only** for v1; the engine is source-agnostic but only Google is wired.
- **Commits:** conventional-commit format, **no attribution lines** (repo convention).
- **Run a single test file:** `npx vitest run <path>`. **Run e2e:** `npx playwright test <path>`.

## File Structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `src/lib/decision/types.ts` | Modify | Add `userRatingCount?: number \| null` to `Restaurant` |
| `src/lib/places/client.ts` | Modify | Request + map `userRatingCount` from Places |
| `src/lib/places/client.test.ts` | Modify | Assert field-mask + mapping |
| `src/lib/vote/snapshot.ts` | Modify | Carry `userRatingCount` through snapshots |
| `src/lib/vote/snapshot.test.ts` | Modify | Round-trip test for `userRatingCount` |
| `src/components/RestaurantCard.tsx` | Modify | Show review count next to rating |
| `src/components/RestaurantCard.test.tsx` | Modify | Assert count display |
| `src/lib/decision/score.ts` | **Create** | The scoring engine (pure) |
| `src/lib/decision/score.test.ts` | **Create** | Unit tests for the engine |
| `src/components/BrowseView.tsx` | Modify | Order list by score + "top picks" seed button |
| `src/components/BrowseView.test.tsx` | Modify | Ordering + seeding tests |
| `src/components/DecideView.tsx` | Modify | Weighted Surprise pick |
| `src/components/DecideView.test.tsx` | Modify | Weighted-pick test |
| `e2e/smart-ranking.spec.ts` | **Create** | Browse shows best-first end-to-end |
| `README.md` | Modify | "Smart recommendations" note |

---

### Task 1: Add `userRatingCount` to the model + Places fetch

**Files:**
- Modify: `src/lib/decision/types.ts`
- Modify: `src/lib/places/client.ts`
- Test: `src/lib/places/client.test.ts`

**Interfaces:**
- Produces: `Restaurant.userRatingCount?: number | null`; `fetchNearby` now populates it.

- [ ] **Step 1: Write the failing tests** — append to `src/lib/places/client.test.ts`:

```ts
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
```

(Ensure `fetchNearby` is imported at the top of the file — it already is.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/places/client.test.ts`
Expected: FAIL — mask does not contain `places.userRatingCount`; `r.userRatingCount` is `undefined`.

- [ ] **Step 3: Add the field to the model** — in `src/lib/decision/types.ts`, inside `interface Restaurant`, add after the `rating` line:

```ts
  rating: number | null;
  userRatingCount?: number | null; // number of reviews behind `rating`; absent on legacy data
```

- [ ] **Step 4: Fetch and map it** — in `src/lib/places/client.ts`:

In `interface RawPlace`, add after `rating?: number;`:
```ts
  userRatingCount?: number;
```
In `FIELD_MASK`, add after `"places.rating",`:
```ts
  "places.userRatingCount",
```
In the `.map((p): Restaurant => ({ ... }))`, add after `rating: p.rating ?? null,`:
```ts
      userRatingCount: p.userRatingCount ?? null,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/places/client.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/decision/types.ts src/lib/places/client.ts src/lib/places/client.test.ts
git commit -m "feat: fetch userRatingCount from Places and add to Restaurant model"
```

---

### Task 2: Carry review count through snapshots + show it on cards

**Files:**
- Modify: `src/lib/vote/snapshot.ts`
- Test: `src/lib/vote/snapshot.test.ts`
- Modify: `src/components/RestaurantCard.tsx`
- Test: `src/components/RestaurantCard.test.tsx`

**Interfaces:**
- Consumes: `Restaurant.userRatingCount` (Task 1).
- Produces: snapshots include `userRatingCount`; `RestaurantCard` renders `★ <rating> (<count>)` when count is a number.

- [ ] **Step 1: Write the failing snapshot tests** — append to `src/lib/vote/snapshot.test.ts`:

```ts
it("carries userRatingCount through a snapshot round-trip", () => {
  const r: Restaurant = {
    placeId: "p", name: "P", rating: 4.5, userRatingCount: 1234, priceLevel: 2,
    lat: 1, lng: 2, openNow: true, types: ["restaurant"], photoRef: null,
  };
  const snap = toSnapshot(r);
  expect(snap.userRatingCount).toBe(1234);
  expect(parseSnapshot(snap)?.userRatingCount).toBe(1234);
});

it("defaults missing userRatingCount to null on parse", () => {
  const parsed = parseSnapshot({
    placeId: "p", name: "P", rating: null, priceLevel: null, lat: 0, lng: 0, openNow: null, photoRef: null,
  });
  expect(parsed?.userRatingCount).toBeNull();
});
```

(Confirm `toSnapshot`, `parseSnapshot`, and the `Restaurant` type are imported at the top — `toSnapshot`/`parseSnapshot` already are; add `import type { Restaurant } from "@/lib/decision/types";` if absent.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/vote/snapshot.test.ts`
Expected: FAIL — `snap.userRatingCount` undefined; parsed count undefined.

- [ ] **Step 3: Update snapshot.ts** — in `toSnapshot`'s returned object, add after `rating: r.rating,`:
```ts
    userRatingCount: r.userRatingCount ?? null,
```
In `parseSnapshot`'s returned object, add after `rating: num(v.rating),`:
```ts
    userRatingCount: num(v.userRatingCount),
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/vote/snapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing card test** — append to `src/components/RestaurantCard.test.tsx`:

```ts
it("shows the review count when present", () => {
  render(<RestaurantCard restaurant={{
    placeId: "p", name: "P", rating: 4.5, userRatingCount: 3000, priceLevel: null,
    lat: 0, lng: 0, openNow: null, types: [], photoRef: null,
  }} />);
  expect(screen.getByText("★ 4.5 (3,000)")).toBeInTheDocument();
});

it("omits the count when userRatingCount is absent", () => {
  render(<RestaurantCard restaurant={{
    placeId: "p", name: "P", rating: 4.5, priceLevel: null,
    lat: 0, lng: 0, openNow: null, types: [], photoRef: null,
  }} />);
  expect(screen.getByText("★ 4.5")).toBeInTheDocument();
});
```

(Use the existing imports in that test file — `render`, `screen`, `RestaurantCard`.)

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/components/RestaurantCard.test.tsx`
Expected: FAIL — first test cannot find `★ 4.5 (3,000)`.

- [ ] **Step 7: Update RestaurantCard.tsx** — replace the rating badge span content. Change:

```tsx
          {restaurant.rating !== null ? `★ ${restaurant.rating}` : "No rating"}
```
to:
```tsx
          {restaurant.rating !== null
            ? `★ ${restaurant.rating}${
                typeof restaurant.userRatingCount === "number"
                  ? ` (${restaurant.userRatingCount.toLocaleString()})`
                  : ""
              }`
            : "No rating"}
```

- [ ] **Step 8: Run to verify pass (and no regressions)**

Run: `npx vitest run src/components/RestaurantCard.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc clean. (Existing card/Browse/Vote tests stay green because their fixtures leave `userRatingCount` undefined, so no suffix is appended.)

- [ ] **Step 9: Commit**

```bash
git add src/lib/vote/snapshot.ts src/lib/vote/snapshot.test.ts src/components/RestaurantCard.tsx src/components/RestaurantCard.test.tsx
git commit -m "feat: carry review count through snapshots and show it on cards"
```

---

### Task 3: Scoring core — `bayesianRating` + `scoreRestaurant`

**Files:**
- Create: `src/lib/decision/score.ts`
- Test: `src/lib/decision/score.test.ts`

**Interfaces:**
- Consumes: `Restaurant`, `LatLng` (`@/lib/decision/types`), `haversineMeters` (`@/lib/decision/distance`).
- Produces:
  - `interface ScoreWeights { rating; distance; openNow; price }`
  - `interface ScoreConfig { weights: ScoreWeights; bayesMinCount: number; priorMeanFallback: number; maxDistanceMeters: number }`
  - `interface ScoreBreakdown { adjustedRating; ratingScore; distanceScore; openNowScore; priceScore }`
  - `interface ScoredRestaurant { restaurant: Restaurant; score: number; breakdown: ScoreBreakdown }`
  - `const DEFAULT_SCORE_CONFIG: ScoreConfig`
  - `bayesianRating(rating: number|null, count: number|null, priorMean: number, minCount: number): number`
  - `scoreRestaurant(r: Restaurant, origin: LatLng, poolMean: number, config: ScoreConfig): ScoredRestaurant`

- [ ] **Step 1: Write the failing tests** — create `src/lib/decision/score.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bayesianRating, scoreRestaurant, DEFAULT_SCORE_CONFIG } from "@/lib/decision/score";
import type { Restaurant } from "@/lib/decision/types";

const ORIGIN = { lat: 1.3, lng: 103.8 };

function r(over: Partial<Restaurant> = {}): Restaurant {
  return {
    placeId: "p", name: "P", rating: 4.0, userRatingCount: 100, priceLevel: null,
    lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null, ...over,
  };
}

describe("bayesianRating", () => {
  it("keeps the rating when the review count is high", () => {
    expect(bayesianRating(4.5, 3000, 3.8, 50)).toBeCloseTo(4.49, 1);
  });
  it("pulls low-count ratings toward the prior mean", () => {
    expect(bayesianRating(4.9, 12, 3.8, 50)).toBeCloseTo(4.01, 1);
  });
  it("ranks a credible 4.5/3000 above a shiny 4.9/12", () => {
    expect(bayesianRating(4.5, 3000, 3.8, 50)).toBeGreaterThan(bayesianRating(4.9, 12, 3.8, 50));
  });
  it("returns the prior mean when rating or count is missing", () => {
    expect(bayesianRating(null, null, 3.8, 50)).toBe(3.8);
    expect(bayesianRating(4.9, 0, 3.8, 50)).toBe(3.8);
    expect(bayesianRating(4.9, null, 3.8, 50)).toBe(3.8);
  });
});

describe("scoreRestaurant", () => {
  it("combines rating, distance and open-now with the default weights", () => {
    const scored = scoreRestaurant(r({ rating: 4.5, userRatingCount: 3000, openNow: true }), ORIGIN, 3.8, DEFAULT_SCORE_CONFIG);
    expect(scored.breakdown.distanceScore).toBe(1); // at origin
    expect(scored.breakdown.openNowScore).toBe(1);
    expect(scored.breakdown.priceScore).toBe(0);
    expect(scored.score).toBeCloseTo(0.939, 2);
  });
  it("gives a neutral 0.5 open-now score when open status is unknown", () => {
    const scored = scoreRestaurant(r({ openNow: null }), ORIGIN, 3.8, DEFAULT_SCORE_CONFIG);
    expect(scored.breakdown.openNowScore).toBe(0.5);
  });
  it("treats a missing userRatingCount as zero reviews (shrinks to pool mean)", () => {
    const scored = scoreRestaurant(r({ rating: 4.9, userRatingCount: null }), ORIGIN, 3.8, DEFAULT_SCORE_CONFIG);
    expect(scored.breakdown.adjustedRating).toBe(3.8);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/decision/score.test.ts`
Expected: FAIL — module `@/lib/decision/score` not found.

- [ ] **Step 3: Create `src/lib/decision/score.ts`**

```ts
import type { LatLng, Restaurant } from "@/lib/decision/types";
import { haversineMeters } from "@/lib/decision/distance";

export interface ScoreWeights {
  rating: number;
  distance: number;
  openNow: number;
  price: number;
}

export interface ScoreConfig {
  weights: ScoreWeights;
  bayesMinCount: number;     // m
  priorMeanFallback: number; // C fallback when the pool has no ratings
  maxDistanceMeters: number; // distance normalisation ceiling
}

export interface ScoreBreakdown {
  adjustedRating: number;
  ratingScore: number;
  distanceScore: number;
  openNowScore: number;
  priceScore: number;
}

export interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number;
  breakdown: ScoreBreakdown;
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  weights: { rating: 0.6, distance: 0.3, openNow: 0.1, price: 0 },
  bayesMinCount: 50,
  priorMeanFallback: 3.8,
  maxDistanceMeters: 5000,
};

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function bayesianRating(
  rating: number | null,
  count: number | null,
  priorMean: number,
  minCount: number,
): number {
  const v = count ?? 0;
  if (v <= 0) return priorMean;
  const R = rating ?? priorMean;
  return (v / (v + minCount)) * R + (minCount / (v + minCount)) * priorMean;
}

export function scoreRestaurant(
  r: Restaurant,
  origin: LatLng,
  poolMean: number,
  config: ScoreConfig,
): ScoredRestaurant {
  const adjustedRating = bayesianRating(r.rating, r.userRatingCount ?? null, poolMean, config.bayesMinCount);
  const ratingScore = adjustedRating / 5;
  const dist = haversineMeters(origin, { lat: r.lat, lng: r.lng });
  const distanceScore = 1 - clamp(dist / config.maxDistanceMeters, 0, 1);
  const openNowScore = r.openNow === true ? 1 : r.openNow === null ? 0.5 : 0;
  const priceScore = 0; // carried in the model but not scored in v1 (needs a user preference)
  const w = config.weights;
  const score =
    w.rating * ratingScore +
    w.distance * distanceScore +
    w.openNow * openNowScore +
    w.price * priceScore;
  return { restaurant: r, score, breakdown: { adjustedRating, ratingScore, distanceScore, openNowScore, priceScore } };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/decision/score.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/decision/score.ts src/lib/decision/score.test.ts
git commit -m "feat: add Bayesian rating and per-restaurant scoring"
```

---

### Task 4: Pool logic — `rankRestaurants` + `weightedPick`

**Files:**
- Modify: `src/lib/decision/score.ts`
- Test: `src/lib/decision/score.test.ts`

**Interfaces:**
- Consumes: `scoreRestaurant`, `DEFAULT_SCORE_CONFIG`, `ScoredRestaurant` (Task 3).
- Produces:
  - `rankRestaurants(pool: Restaurant[], origin: LatLng, config?: Partial<ScoreConfig>): ScoredRestaurant[]` (sorted desc)
  - `weightedPick(scored: ScoredRestaurant[], rng?: () => number, previousId?: string): Restaurant | null`

- [ ] **Step 1: Write the failing tests** — append to `src/lib/decision/score.test.ts`:

```ts
import { rankRestaurants, weightedPick } from "@/lib/decision/score";
import type { ScoredRestaurant } from "@/lib/decision/score";

function sr(id: string, score: number): ScoredRestaurant {
  return {
    restaurant: r({ placeId: id, name: id }),
    score,
    breakdown: { adjustedRating: 0, ratingScore: 0, distanceScore: 0, openNowScore: 0, priceScore: 0 },
  };
}

describe("rankRestaurants", () => {
  it("returns an empty array for an empty pool", () => {
    expect(rankRestaurants([], ORIGIN)).toEqual([]);
  });
  it("orders best-first and ranks a credible spot above a shiny low-count one", () => {
    const pool = [
      r({ placeId: "shiny", name: "shiny", rating: 4.9, userRatingCount: 4 }),
      r({ placeId: "credible", name: "credible", rating: 4.5, userRatingCount: 4000 }),
      r({ placeId: "dive", name: "dive", rating: 2.5, userRatingCount: 300 }),
    ];
    const ranked = rankRestaurants(pool, ORIGIN);
    expect(ranked.map((s) => s.restaurant.placeId)).toEqual(["credible", "shiny", "dive"]);
  });
  it("uses the prior-mean fallback when no restaurant has a rating", () => {
    const ranked = rankRestaurants([r({ rating: null, userRatingCount: null })], ORIGIN);
    expect(ranked[0].breakdown.adjustedRating).toBe(DEFAULT_SCORE_CONFIG.priorMeanFallback);
  });
});

describe("weightedPick", () => {
  it("returns null for an empty list", () => {
    expect(weightedPick([])).toBeNull();
  });
  it("returns the only item", () => {
    expect(weightedPick([sr("a", 0.5)])?.placeId).toBe("a");
  });
  it("selects proportionally to score using rng", () => {
    const scored = [sr("a", 0.9), sr("b", 0.1)]; // total 1.0
    expect(weightedPick(scored, () => 0)?.placeId).toBe("a");
    expect(weightedPick(scored, () => 0.95)?.placeId).toBe("b");
  });
  it("excludes the previous pick when alternatives exist", () => {
    const scored = [sr("a", 0.9), sr("b", 0.1)];
    expect(weightedPick(scored, () => 0, "a")?.placeId).toBe("b");
  });
  it("falls back to uniform selection when all scores are zero", () => {
    const scored = [sr("a", 0), sr("b", 0)];
    expect(weightedPick(scored, () => 0)?.placeId).toBe("a");
    expect(weightedPick(scored, () => 0.99)?.placeId).toBe("b");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/decision/score.test.ts`
Expected: FAIL — `rankRestaurants` / `weightedPick` not exported.

- [ ] **Step 3: Append to `src/lib/decision/score.ts`**

```ts
function mergeConfig(p: Partial<ScoreConfig>): ScoreConfig {
  return {
    ...DEFAULT_SCORE_CONFIG,
    ...p,
    weights: { ...DEFAULT_SCORE_CONFIG.weights, ...(p.weights ?? {}) },
  };
}

function poolMeanRating(pool: Restaurant[], fallback: number): number {
  const rated = pool.filter((r): r is Restaurant & { rating: number } => r.rating !== null);
  if (rated.length === 0) return fallback;
  return rated.reduce((sum, r) => sum + r.rating, 0) / rated.length;
}

export function rankRestaurants(
  pool: Restaurant[],
  origin: LatLng,
  config: Partial<ScoreConfig> = {},
): ScoredRestaurant[] {
  const cfg = mergeConfig(config);
  const poolMean = poolMeanRating(pool, cfg.priorMeanFallback);
  return pool
    .map((r) => scoreRestaurant(r, origin, poolMean, cfg))
    .sort((a, b) => b.score - a.score);
}

export function weightedPick(
  scored: ScoredRestaurant[],
  rng: () => number = Math.random,
  previousId?: string,
): Restaurant | null {
  if (scored.length === 0) return null;
  const candidates =
    previousId && scored.length > 1
      ? scored.filter((s) => s.restaurant.placeId !== previousId)
      : scored;
  const weights = candidates.map((s) => Math.max(s.score, 0));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    return candidates[Math.floor(rng() * candidates.length)].restaurant;
  }
  let threshold = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    threshold -= weights[i];
    if (threshold < 0) return candidates[i].restaurant;
  }
  return candidates[candidates.length - 1].restaurant;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/decision/score.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/decision/score.ts src/lib/decision/score.test.ts
git commit -m "feat: add rankRestaurants and weightedPick to scoring engine"
```

---

### Task 5: Order Browse results by smart score

**Files:**
- Modify: `src/components/BrowseView.tsx`
- Test: `src/components/BrowseView.test.tsx`

**Interfaces:**
- Consumes: `rankRestaurants` (Task 4).
- Produces: `ranked` (a `Restaurant[]` in best-first order) used for rendering and (Task 7) seeding.

- [ ] **Step 1: Write the failing test** — append to `src/components/BrowseView.test.tsx`:

```ts
it("orders restaurants best-first by smart score", async () => {
  const origin = { lat: 1.3, lng: 103.8 };
  const pool = [
    { placeId: "shiny", name: "shiny", rating: 4.9, userRatingCount: 4, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
    { placeId: "credible", name: "credible", rating: 4.5, userRatingCount: 4000, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
    { placeId: "low", name: "low", rating: 3.0, userRatingCount: 500, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
  ];
  render(<BrowseView origin={origin} autoStartCoords={origin} loadRestaurants={async () => pool} />);
  const names = (await screen.findAllByRole("heading", { level: 2 })).map((h) => h.textContent);
  expect(names[0]).toBe("credible");
  expect(names.indexOf("credible")).toBeLessThan(names.indexOf("shiny"));
});
```

(Use the existing imports in that test file — `render`, `screen`, `BrowseView`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/BrowseView.test.tsx`
Expected: FAIL — `names[0]` is `"shiny"` (Google/input order), not `"credible"`.

- [ ] **Step 3: Add ranking to `BrowseView.tsx`**

Add the import near the other `@/lib/decision` imports:
```tsx
import { rankRestaurants } from "@/lib/decision/score";
```
After the existing `filtered` `useMemo` block, add:
```tsx
  const ranked = useMemo(
    () => rankRestaurants(filtered, origin).map((s) => s.restaurant),
    [filtered, origin],
  );
```
Replace the list render. Change `{filtered.map((rst) => (` to `{ranked.map((rst) => (`. (Leave the `filtered.length === 0` empty-state check and the `{filtered.length} spots` count as-is — `ranked` and `filtered` always have equal length.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/BrowseView.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/BrowseView.tsx src/components/BrowseView.test.tsx
git commit -m "feat: order Browse results by smart score"
```

---

### Task 6: Weight the Surprise pick by smart score

**Files:**
- Modify: `src/components/DecideView.tsx`
- Test: `src/components/DecideView.test.tsx`

**Interfaces:**
- Consumes: `rankRestaurants`, `weightedPick`, `ScoredRestaurant` (Task 4).

- [ ] **Step 1: Write the failing test** — append to `src/components/DecideView.test.tsx`:

```ts
it("favors the highest-scored restaurant when rng=0", async () => {
  const origin = { lat: 1.3, lng: 103.8 };
  const pool = [
    { placeId: "shiny", name: "shiny", rating: 4.9, userRatingCount: 4, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
    { placeId: "credible", name: "credible", rating: 4.5, userRatingCount: 4000, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
    { placeId: "dive", name: "dive", rating: 2.5, userRatingCount: 300, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
  ];
  render(<DecideView autoStartCoords={origin} loadRestaurants={async () => pool} rng={() => 0} />);
  expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent("credible");
});
```

(Use the existing imports in that test file — `render`, `screen`, `DecideView`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/DecideView.test.tsx`
Expected: FAIL — uniform `pickRandom` with `rng=0` shows `"shiny"` (input index 0), not `"credible"`.

- [ ] **Step 3: Switch DecideView to weighted pick**

Replace the import line `import { pickRandom } from "@/lib/decision/pick";` with:
```tsx
import { rankRestaurants, weightedPick, type ScoredRestaurant } from "@/lib/decision/score";
```
Replace the `pool` state line `const [pool, setPool] = useState<Restaurant[]>([]);` with:
```tsx
  const [scored, setScored] = useState<ScoredRestaurant[]>([]);
```
In the `start` callback body, replace:
```tsx
        const list = await loadRestaurants(coords);
        setPool(list);
        if (list.length === 0) {
          setStatus("empty");
          return;
        }
        setCurrent(pickRandom(list, undefined, rng));
        setStatus("ready");
```
with:
```tsx
        const list = await loadRestaurants(coords);
        const ranked = rankRestaurants(list, coords);
        setScored(ranked);
        if (ranked.length === 0) {
          setStatus("empty");
          return;
        }
        setCurrent(weightedPick(ranked, rng));
        setStatus("ready");
```
Replace the `again` callback:
```tsx
  const again = useCallback(
    () => setCurrent(weightedPick(scored, rng, current?.placeId)),
    [scored, current, rng],
  );
```

(`Restaurant` stays imported — it is still used for `current`'s type. `pickRandom` and its file remain in the codebase as the uniform fallback that `weightedPick` mirrors; only DecideView's import changes.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/DecideView.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/DecideView.tsx src/components/DecideView.test.tsx
git commit -m "feat: weight Surprise pick by smart score"
```

---

### Task 7: Seed a group vote with the top picks

**Files:**
- Modify: `src/components/BrowseView.tsx`
- Test: `src/components/BrowseView.test.tsx`

**Interfaces:**
- Consumes: `ranked` (Task 5), the existing `onVoteWithTeam?: (picks: Restaurant[]) => void` prop (already wired through `/browse` → draft → `/vote`).
- Produces: a "Vote with top picks" action that calls `onVoteWithTeam` with the top-N ranked restaurants.

- [ ] **Step 1: Write the failing test** — append to `src/components/BrowseView.test.tsx`:

```ts
it("seeds a team vote with the top picks in ranked order", async () => {
  const origin = { lat: 1.3, lng: 103.8 };
  const pool = [
    { placeId: "shiny", name: "shiny", rating: 4.9, userRatingCount: 4, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
    { placeId: "credible", name: "credible", rating: 4.5, userRatingCount: 4000, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
    { placeId: "dive", name: "dive", rating: 2.5, userRatingCount: 300, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
  ];
  const onVoteWithTeam = vi.fn();
  render(<BrowseView origin={origin} autoStartCoords={origin} loadRestaurants={async () => pool} onVoteWithTeam={onVoteWithTeam} />);
  await screen.findByRole("heading", { level: 2 });
  await userEvent.click(screen.getByRole("button", { name: /top .* picks/i }));
  expect(onVoteWithTeam).toHaveBeenCalledTimes(1);
  const picks = onVoteWithTeam.mock.calls[0][0] as { placeId: string }[];
  expect(picks.map((p) => p.placeId)).toEqual(["credible", "shiny", "dive"]);
});
```

(Ensure `vi` is imported from `vitest` and `userEvent` from `@testing-library/user-event` at the top of the test file — add `import userEvent from "@testing-library/user-event";` if absent.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/BrowseView.test.tsx`
Expected: FAIL — no button matching `/top .* picks/i`.

- [ ] **Step 3: Add the top-picks button to `BrowseView.tsx`**

Below the `MAX_SELECTED` constant near the top of the file, add:
```tsx
const TOP_PICKS_N = 4;
```
Add the seed handler next to `startVote`:
```tsx
  const seedTopPicks = useCallback(() => {
    if (!onVoteWithTeam) return;
    onVoteWithTeam(ranked.slice(0, TOP_PICKS_N));
  }, [onVoteWithTeam, ranked]);
```
In the JSX, immediately after `<FilterControls value={criteria} onChange={setCriteria} />`, add:
```tsx
      {selectable && ranked.length >= 2 && (
        <button
          type="button"
          onClick={seedTopPicks}
          className="tile tile-press w-full bg-mustard px-4 py-3 text-center font-display text-lg font-bold text-ink"
        >
          ⭐ Vote with top {Math.min(TOP_PICKS_N, ranked.length)} picks
        </button>
      )}
```

(`selectable` and `ranked` are already in scope from earlier in the component.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/BrowseView.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/BrowseView.tsx src/components/BrowseView.test.tsx
git commit -m "feat: seed group vote with top picks"
```

---

### Task 8: End-to-end test, docs, and full verification

**Files:**
- Create: `e2e/smart-ranking.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: the full feature (Tasks 1–7) running through `/browse`.

- [ ] **Step 1: Write the e2e test** — create `e2e/smart-ranking.spec.ts` (mirrors the mock-`/api/nearby` pattern in `e2e/surprise.spec.ts`):

```ts
import { test, expect } from "@playwright/test";

// Same location + open status for all, so ordering is driven purely by the
// review-count-weighted rating. "Credible" (4.4 / 5000) must beat the shiny
// low-count "Alpha" (4.9 / 4); two low-rated spots pull the pool mean down.
const NEARBY = {
  restaurants: [
    { placeId: "p-alpha", name: "Alpha Diner", rating: 4.9, userRatingCount: 4, priceLevel: 2, lat: 1.3, lng: 103.8, openNow: true, types: ["restaurant"], photoRef: null },
    { placeId: "p-cred", name: "Credible Cafe", rating: 4.4, userRatingCount: 5000, priceLevel: 2, lat: 1.3, lng: 103.8, openNow: true, types: ["restaurant"], photoRef: null },
    { placeId: "p-c", name: "Cheap Eats", rating: 3.2, userRatingCount: 800, priceLevel: 1, lat: 1.3, lng: 103.8, openNow: true, types: ["restaurant"], photoRef: null },
    { placeId: "p-d", name: "Diner Down", rating: 3.5, userRatingCount: 600, priceLevel: 1, lat: 1.3, lng: 103.8, openNow: true, types: ["restaurant"], photoRef: null },
  ],
};

test.use({ permissions: ["geolocation"], geolocation: { latitude: 1.3, longitude: 103.8 } });

test("Browse orders results best-first by smart score", async ({ page }) => {
  await page.route("**/api/nearby", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(NEARBY) }),
  );

  await page.goto("/browse");
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();

  const names = await page.getByRole("heading", { level: 2 }).allTextContents();
  // Credible Cafe (4.4 / 5000) ranks above the shiny low-count Alpha (4.9 / 4).
  expect(names.indexOf("Credible Cafe")).toBeLessThan(names.indexOf("Alpha Diner"));
  expect(names[0]).toBe("Credible Cafe");
});
```

- [ ] **Step 2: Run the e2e test**

Run: `npx playwright test e2e/smart-ranking.spec.ts`
Expected: PASS (1 test). If the dev/preview server is not auto-started by `playwright.config.ts`, start it per the existing e2e workflow first.

- [ ] **Step 3: Document the feature** — in `README.md`, add this section after the "Group voting (Plan 2)" section:

```markdown
## Smart recommendations

Restaurants are ranked by a **smart score**, not raw Google rating:

- **Review-count-weighted rating** (Bayesian) so a place with 4.9 from 12 reviews
  doesn't outrank a 4.5 from 3,000.
- Combined with **distance** (closer is better) and **open-now**.
- Powers **Browse** ordering, the **Surprise** pick (weighted random), and the
  **"Vote with top picks"** group-vote shortcut.

Weights live in `src/lib/decision/score.ts` (`DEFAULT_SCORE_CONFIG`) and are easy to tune.
Only Google signals are used today; the engine is source-agnostic for future sources.
```

- [ ] **Step 4: Full verification (whole suite + types + build)**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all unit/component tests PASS; tsc clean; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add e2e/smart-ranking.spec.ts README.md
git commit -m "test: e2e for smart ranking; docs: note smart recommendations"
```

---

## Self-Review

**Spec coverage:**
- Bayesian-adjusted rating → Task 3 (`bayesianRating`, with the 4.5/3000 vs 4.9/12 regression test). ✓
- Composite score + weights 0.6/0.3/0.1/0.0 → Task 3 (`scoreRestaurant`, `DEFAULT_SCORE_CONFIG`). ✓
- `userRatingCount` added to model + field mask → Task 1. ✓
- `rankRestaurants` / `weightedPick` → Task 4. ✓
- Browse ordering → Task 5. ✓
- Surprise weighted pick → Task 6. ✓
- Group vote seeding via existing `onVoteWithTeam` seam → Task 7. ✓
- Null/edge handling (missing rating/count → pool mean; empty pool → []/null; equal scores → uniform; openNow null → 0.5) → Tasks 3 & 4. ✓
- Tests: unit + component + e2e → Tasks 3–8. ✓
- Deferred items (multi-source, preferences, history, price weight 0) → not built; `priceScore` weight 0 in Task 3. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases" — every code and test step has concrete content. ✓

**Type consistency:** `ScoredRestaurant`, `ScoreConfig`, `rankRestaurants`, `weightedPick`, `DEFAULT_SCORE_CONFIG`, `bayesianRating`, `scoreRestaurant` are named identically across Tasks 3–7. `userRatingCount?: number | null` is consistent in types, client, snapshot, and fixtures. `onVoteWithTeam(picks: Restaurant[])` matches the existing BrowseView prop. ✓

**Decision note:** `userRatingCount` is optional-nullable specifically so the ~13 existing files that build `Restaurant`/snapshot literals compile untouched and stay green; only fixtures that opt into a count exercise the new display/scoring paths.
