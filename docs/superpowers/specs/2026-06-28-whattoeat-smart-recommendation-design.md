# Smart Recommendation Engine (v1 — objective score) — Design

- **Date:** 2026-06-28
- **Status:** Approved (design); pending spec review
- **Branch:** `feat/smart-recommendation`

## Context & motivation

Today the app ranks restaurants by Google's raw `rating` only:

- **Browse** shows results in Google's default order.
- **Surprise** picks uniformly at random (`pickRandom`).
- **Group vote** options are chosen by hand (or seeded from a Browse multi-select).

Raw rating is a thin, misleading signal: a place with **4.9 from 12 reviews** outranks one with
**4.5 from 3,000 reviews**, even though the second is the safer bet. This feature replaces raw
rating with a **smarter objective score** computed from the Google signals we already have access to.

### Scope decisions (from brainstorming)

- **Sources:** Google Places only for v1. Users are in **SEA / Singapore / Malaysia**, where
  Yelp/Foursquare coverage is weak. The engine is designed **source-agnostic** so additional
  sources can plug in later without reworking callers.
- **Smartness level:** a **better universal objective score** — no user accounts, no stored
  preferences, no history/learning. Same score for everyone.
- **Surfaces:** all three — **Browse ordering**, **Surprise pick**, **Group vote seeding**.

### Explicitly out of scope (YAGNI)

- Reviews/ratings from Facebook, Instagram, Xiaohongshu — not reachable via official APIs
  (IG/XHS expose no rating concept; FB locks reviews behind business verification). Deferred.
- Multi-source blending (Yelp/Foursquare) — architecture is ready; not built.
- User preferences, dietary filters as *ranking* inputs, history, per-user learning.
- Price as a ranking signal (carried in the model, weight `0` until preferences exist).

## Approaches considered

| Approach | Description | Verdict |
|----------|-------------|---------|
| **A — Weighted composite w/ Bayesian rating** | Credibility-adjusted rating + distance + open-now combined into one 0–1 score | **Chosen** — transparent, tunable, fully unit-testable, no ML |
| B — Bayesian rating only | Rank purely by review-count-adjusted rating | Rejected — ignores "closer is better" |
| C — Learned / ML ranking | Train on user behaviour | Rejected — needs identity + history, which are out of scope |

## The score

### Bayesian-adjusted rating

Pulls low-confidence ratings toward the pool mean (same technique as IMDb's weighted rating):

```
adjusted = (v / (v + m)) * R + (m / (v + m)) * C

  R = the place's rating
  v = the place's review count (userRatingCount)
  C = mean rating across the candidate pool
  m = confidence threshold (default 50 reviews; tunable constant)
```

- High review count (`v >> m`) → `adjusted ≈ R` (rating trusted as-is).
- Low review count (`v << m`) → `adjusted ≈ C` (pulled to the pool average).
- This makes **4.5 / 3,000 reviews** rank above **4.9 / 12 reviews** — the core requirement.

### Composite score (0–1)

Each component is normalised to `[0, 1]`, then combined with tunable weights:

| Component | Formula | Default weight |
|-----------|---------|----------------|
| `ratingScore` | `adjusted / 5` | **0.6** |
| `distanceScore` | `1 - clamp(distance / maxDistance, 0, 1)` (closer = higher) | **0.3** |
| `openNowScore` | `openNow === true ? 1 : openNow === null ? 0.5 : 0` | **0.1** |
| `priceScore` | carried, not computed | **0.0** (needs a user preference; deferred) |

```
score = wRating·ratingScore + wDistance·distanceScore + wOpenNow·openNowScore + wPrice·priceScore
```

All weights and constants (`m`, prior mean fallback, `maxDistance`, the four weights) live as
**named constants** in one config object so they are trivial to tune and to assert in tests.

### Null / edge handling

- `rating` missing **or** `userRatingCount` 0/null → `adjusted` falls to pool mean `C` (neutral).
- Pool mean `C`: average of available ratings in the pool; if the pool has **no** ratings at all,
  use a fixed prior mean fallback (default `3.8`).
- `distance` is always computable from `lat/lng` + origin (`haversineMeters`).
- `openNow === null` → neutral `0.5`.
- Empty pool → `rankRestaurants` returns `[]`; `weightedPick` returns `null`.
- All scores equal/zero → `weightedPick` degrades to uniform random.

## Architecture

### New module: `src/lib/decision/score.ts` (pure, no side effects)

Reuses the existing `haversineMeters` from `src/lib/decision/distance.ts`.

```ts
export interface ScoreWeights {
  rating: number;    // default 0.6
  distance: number;  // default 0.3
  openNow: number;   // default 0.1
  price: number;     // default 0.0
}

export interface ScoreConfig {
  weights: ScoreWeights;
  bayesMinCount: number;     // m, default 50
  priorMeanFallback: number; // C fallback when pool has no ratings, default 3.8
  maxDistanceMeters: number; // distance normalisation ceiling; default = nearby search radius, fallback 5000
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
  score: number;          // 0..1
  breakdown: ScoreBreakdown;
}

export function bayesianRating(
  rating: number | null, count: number | null, priorMean: number, minCount: number,
): number;

export function scoreRestaurant(
  r: Restaurant, origin: LatLng, poolMean: number, config: ScoreConfig,
): ScoredRestaurant;

// computes pool mean, scores every restaurant, returns sorted desc by score
export function rankRestaurants(
  pool: Restaurant[], origin: LatLng, config?: Partial<ScoreConfig>,
): ScoredRestaurant[];

// score-weighted random selection; excludes previousId; uniform fallback when weights equal
export function weightedPick(
  scored: ScoredRestaurant[], rng?: () => number, previousId?: string,
): Restaurant | null;
```

`breakdown` is retained for transparency (UI "why" hints) and for precise unit assertions.

### Changed files

- **`src/lib/decision/types.ts`** — add `userRatingCount: number | null` to `Restaurant`.
- **`src/lib/places/client.ts`** — add `places.userRatingCount` to `FIELD_MASK`; map
  `p.userRatingCount ?? null` in the `RawPlace → Restaurant` mapping. (Stays in the same Places
  "Pro" SKU as `rating`/`priceLevel`, which are already requested — no new billing tier. To be
  confirmed against current Google pricing during implementation.)

### Surfaces (all reuse the module)

1. **Browse** (`BrowseView.tsx` + nearby flow) — after fetch + existing filters, call
   `rankRestaurants(pool, origin)` and render best-first. Cards surface `rating` + review count
   as the "why".
2. **Surprise** (`DecideView.tsx`) — replace uniform `pickRandom` with `weightedPick` over the
   scored pool. Existing "avoid previous pick" behaviour is preserved. `pickRandom` stays in the
   codebase as the uniform fallback `weightedPick` delegates to when all weights are equal (keeps
   its existing tests).
3. **Group vote seeding** — a "Top picks near me" action produces the top-N (default 4) scored
   restaurants as `VoteOptionInput[]` (with `placeId` + `snapshot`) and passes them as
   `initialOptions` to `QuickVoteForm` — using the seam already built for vote-with-team.

## Testing (TDD, ≥80% coverage)

**Unit (`score.test.ts`):**
- `bayesianRating`: high-count keeps `R`; low-count pulls toward `C`; null rating/count → `C`.
- Literal regression: **4.5 / 3,000 outranks 4.9 / 12**.
- `scoreRestaurant`: each component normalised correctly; weights applied; breakdown exact.
- `rankRestaurants`: descending order; pool-mean computed; empty pool → `[]`; no-ratings pool
  uses prior-mean fallback.
- `weightedPick`: deterministic with seeded RNG; excludes `previousId`; degrades to uniform when
  weights equal; empty input → `null`.

**Component:**
- `BrowseView` renders best-first by score.
- `DecideView` Surprise uses weighted pick (seeded RNG).
- Vote seeding selects the top-N as `initialOptions`.

**E2E (Playwright):**
- Browse shows results best-first.
- (Optional) seed-from-top-picks → vote room flow.

## Risks & mitigations

- **Google pricing for `userRatingCount`:** believed in-SKU; confirm during build before merge.
- **Weight tuning is subjective:** mitigated by named constants + breakdown visibility; defaults
  chosen to let rating dominate while distance still breaks ties meaningfully.
- **Pool mean instability with tiny pools:** prior-mean fallback + `m` threshold dampen this.

## Future extension points

- Plug additional sources into the `Restaurant` shape and aggregate before scoring (source-agnostic).
- Turn on `priceScore` (and add cuisine/dietary match) once a user-preference layer exists.
- History/learning once user identity is introduced.
