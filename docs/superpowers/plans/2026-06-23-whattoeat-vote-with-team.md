# Vote-with-team Handoff (Plan 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user multi-select real restaurants on the Browse screen and start a group vote on exactly those, carrying each pick's name + placeId + snapshot so the vote room shows real restaurant cards.

**Architecture:** Frontend-only. Browse writes the selected picks to `sessionStorage`, then routes to the existing Quick-vote form pre-filled with them; the form's existing `POST /api/sessions` path already accepts `placeId`/`snapshot`. The vote room (which already receives `snapshot` on every option) renders rating/price/Directions when a snapshot is present. No backend, API, DB, or repository changes.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Vitest + @testing-library/react · Playwright.

## Global Constraints

- **No backend/API/DB/repository changes.** `POST /api/sessions` already validates+forwards `placeId`/`snapshot`; `getSession`/`mapOption` already return `snapshot`; `VoteRoom` already receives it.
- **Preserve every existing `aria-label` / `data-testid` / role / status string** on current screens so the 85 unit + existing E2E specs stay green. The only intentional contract change is `QuickVoteForm`'s `onCreate` (string[] → object[]); its existing test is updated in Task 5.
- **Immutability:** never mutate state objects/arrays in place — build new ones (e.g. copy a `Set` before add/delete).
- **Validate at boundaries:** anything read from `sessionStorage` or a stored `snapshot` (`unknown`) must be parsed/guarded; corruption yields an empty result, never a throw.
- **Selection cap = 50** (the API's max options). **Minimum to start a vote = 2.**
- **Test commands:** unit `npm test` (or a single file: `npx vitest run <path>`); E2E `npm run e2e`.
- **Commit style:** Conventional Commits, no attribution trailers (matches existing history).
- **Tailwind tokens already defined** (`tile`, `tile-sm`, `tile-press`, `ticket`, `placemat`, `herb`, `mustard`, `tomato`, `ink`, `ink-soft`, `paper-2`, `herb-ink`, `tomato-ink`, `mustard-ink`). Reuse them; do not invent new colors.

---

### Task 1: Restaurant snapshot helpers

**Files:**
- Create: `src/lib/vote/snapshot.ts`
- Test: `src/lib/vote/snapshot.test.ts`

**Interfaces:**
- Consumes: `Restaurant` from `@/lib/decision/types` (`{ placeId, name, rating: number|null, priceLevel: number|null, lat, lng, openNow: boolean|null, types: string[], photoRef: string|null }`).
- Produces:
  - `type RestaurantSnapshot = Omit<Restaurant, "types">`
  - `toSnapshot(r: Restaurant): RestaurantSnapshot`
  - `parseSnapshot(value: unknown): RestaurantSnapshot | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/vote/snapshot.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toSnapshot, parseSnapshot } from "@/lib/vote/snapshot";
import type { Restaurant } from "@/lib/decision/types";

const r: Restaurant = {
  placeId: "p1", name: "Sushi Spot", rating: 4.6, priceLevel: 2,
  lat: 1.3, lng: 103.8, openNow: true, types: ["restaurant"], photoRef: "ref1",
};

describe("toSnapshot", () => {
  it("keeps render fields and drops types", () => {
    const s = toSnapshot(r);
    expect(s).toEqual({
      placeId: "p1", name: "Sushi Spot", rating: 4.6, priceLevel: 2,
      lat: 1.3, lng: 103.8, openNow: true, photoRef: "ref1",
    });
    expect("types" in s).toBe(false);
  });
});

describe("parseSnapshot", () => {
  it("accepts a well-formed snapshot", () => {
    expect(parseSnapshot(toSnapshot(r))?.name).toBe("Sushi Spot");
  });
  it("rejects non-objects and null", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot("nope")).toBeNull();
    expect(parseSnapshot(42)).toBeNull();
  });
  it("rejects when placeId or name is missing", () => {
    expect(parseSnapshot({ name: "x" })).toBeNull();
    expect(parseSnapshot({ placeId: "x" })).toBeNull();
  });
  it("coerces missing nullable fields to null/0", () => {
    const s = parseSnapshot({ placeId: "p", name: "n" });
    expect(s).toEqual({ placeId: "p", name: "n", rating: null, priceLevel: null, lat: 0, lng: 0, openNow: null, photoRef: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/vote/snapshot.test.ts`
Expected: FAIL — "Failed to resolve import" / `toSnapshot is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/vote/snapshot.ts`:

```ts
import type { Restaurant } from "@/lib/decision/types";

export type RestaurantSnapshot = Omit<Restaurant, "types">;

export function toSnapshot(r: Restaurant): RestaurantSnapshot {
  return {
    placeId: r.placeId,
    name: r.name,
    rating: r.rating,
    priceLevel: r.priceLevel,
    lat: r.lat,
    lng: r.lng,
    openNow: r.openNow,
    photoRef: r.photoRef,
  };
}

export function parseSnapshot(value: unknown): RestaurantSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.placeId !== "string" || typeof v.name !== "string") return null;
  const num = (x: unknown): number | null => (typeof x === "number" ? x : null);
  return {
    placeId: v.placeId,
    name: v.name,
    rating: num(v.rating),
    priceLevel: num(v.priceLevel),
    lat: num(v.lat) ?? 0,
    lng: num(v.lng) ?? 0,
    openNow: typeof v.openNow === "boolean" ? v.openNow : null,
    photoRef: typeof v.photoRef === "string" ? v.photoRef : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/vote/snapshot.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/vote/snapshot.ts src/lib/vote/snapshot.test.ts
git commit -m "feat: add restaurant snapshot helpers for vote handoff"
```

---

### Task 2: sessionStorage draft transport

**Files:**
- Create: `src/lib/vote/draft.ts`
- Test: `src/lib/vote/draft.test.ts`

**Interfaces:**
- Consumes: `RestaurantSnapshot`, `parseSnapshot` from `@/lib/vote/snapshot`.
- Produces:
  - `interface DraftOption { name: string; placeId: string; snapshot: RestaurantSnapshot }`
  - `saveDraft(options: DraftOption[]): void`
  - `loadDraft(): DraftOption[]`
  - `clearDraft(): void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/vote/draft.test.ts` (jsdom provides `window.sessionStorage`):

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { saveDraft, loadDraft, clearDraft, type DraftOption } from "@/lib/vote/draft";

const KEY = "whattoeat:vote-draft";
const pick = (placeId: string, name: string): DraftOption => ({
  name, placeId,
  snapshot: { placeId, name, rating: 4, priceLevel: 2, lat: 0, lng: 0, openNow: true, photoRef: null },
});

describe("vote draft storage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("round-trips saved options", () => {
    const opts = [pick("a", "Alpha"), pick("b", "Beta")];
    saveDraft(opts);
    expect(loadDraft()).toEqual(opts);
  });

  it("returns [] when nothing is stored", () => {
    expect(loadDraft()).toEqual([]);
  });

  it("returns [] on malformed JSON", () => {
    window.sessionStorage.setItem(KEY, "{not json");
    expect(loadDraft()).toEqual([]);
  });

  it("drops entries missing required fields or a valid snapshot", () => {
    window.sessionStorage.setItem(KEY, JSON.stringify([
      pick("a", "Alpha"),
      { name: "NoPlace" },
      { placeId: "c", name: "BadSnap", snapshot: 5 },
    ]));
    expect(loadDraft()).toEqual([pick("a", "Alpha")]);
  });

  it("clears the draft", () => {
    saveDraft([pick("a", "Alpha")]);
    clearDraft();
    expect(loadDraft()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/vote/draft.test.ts`
Expected: FAIL — cannot resolve `@/lib/vote/draft`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/vote/draft.ts`:

```ts
import type { RestaurantSnapshot } from "@/lib/vote/snapshot";
import { parseSnapshot } from "@/lib/vote/snapshot";

const KEY = "whattoeat:vote-draft";
const MAX_OPTIONS = 50;

export interface DraftOption {
  name: string;
  placeId: string;
  snapshot: RestaurantSnapshot;
}

export function saveDraft(options: DraftOption[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(options.slice(0, MAX_OPTIONS)));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function loadDraft(): DraftOption[] {
  if (typeof window === "undefined") return [];
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: DraftOption[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name !== "string" || typeof o.placeId !== "string") continue;
    const snapshot = parseSnapshot(o.snapshot);
    if (!snapshot) continue;
    out.push({ name: o.name, placeId: o.placeId, snapshot });
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/vote/draft.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/vote/draft.ts src/lib/vote/draft.test.ts
git commit -m "feat: add sessionStorage vote-draft transport"
```

---

### Task 3: Shared format helpers + selectable RestaurantCard

**Files:**
- Create: `src/lib/restaurant-format.ts`
- Test: `src/lib/restaurant-format.test.ts`
- Modify: `src/components/RestaurantCard.tsx` (full rewrite below)
- Modify: `src/components/RestaurantCard.test.tsx` (append selectable tests)

**Interfaces:**
- Produces:
  - `priceLabel(level: number | null): string`
  - `mapsUrl(name: string, placeId: string): string`
  - `RestaurantCard` props extended: `selectable?: boolean; selected?: boolean; onToggle?: () => void` (all optional; defaults keep current behavior).

- [ ] **Step 1: Write the failing test for the format helpers**

Create `src/lib/restaurant-format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { priceLabel, mapsUrl } from "@/lib/restaurant-format";

describe("priceLabel", () => {
  it("renders $ repeated by level", () => {
    expect(priceLabel(2)).toBe("$$");
  });
  it("renders empty string for null or 0", () => {
    expect(priceLabel(null)).toBe("");
    expect(priceLabel(0)).toBe("");
  });
});

describe("mapsUrl", () => {
  it("encodes the name and appends the place id", () => {
    expect(mapsUrl("Sushi Spot", "p1")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Sushi%20Spot&query_place_id=p1",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/restaurant-format.test.ts`
Expected: FAIL — cannot resolve `@/lib/restaurant-format`.

- [ ] **Step 3: Implement the format helpers**

Create `src/lib/restaurant-format.ts`:

```ts
export function priceLabel(level: number | null): string {
  return level ? "$".repeat(level) : "";
}

export function mapsUrl(name: string, placeId: string): string {
  return (
    `https://www.google.com/maps/search/?api=1&query=` +
    `${encodeURIComponent(name)}&query_place_id=${placeId}`
  );
}
```

- [ ] **Step 4: Run the format-helper test to verify it passes**

Run: `npx vitest run src/lib/restaurant-format.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing selectable-card test**

Append to `src/components/RestaurantCard.test.tsx` (add `vi` to the vitest import and `userEvent` import at the top of the file: change line 1 to `import { describe, it, expect, vi } from "vitest";` and add `import userEvent from "@testing-library/user-event";`). Then add inside the `describe`:

```tsx
  it("renders no select button by default", () => {
    render(<RestaurantCard restaurant={base} />);
    expect(screen.queryByRole("button", { name: /to vote/i })).toBeNull();
    expect(screen.getByRole("link", { name: /directions/i })).toBeInTheDocument();
  });

  it("toggles selection when selectable", async () => {
    const onToggle = vi.fn();
    render(<RestaurantCard restaurant={base} selectable selected={false} onToggle={onToggle} />);
    const btn = screen.getByRole("button", { name: /add sushi spot to vote/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows the added state when selected", () => {
    render(<RestaurantCard restaurant={base} selectable selected onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /remove sushi spot from vote/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });
```

- [ ] **Step 6: Run the card test to verify the new tests fail**

Run: `npx vitest run src/components/RestaurantCard.test.tsx`
Expected: FAIL — no select button found (props not implemented yet).

- [ ] **Step 7: Rewrite RestaurantCard**

Replace the entire contents of `src/components/RestaurantCard.tsx`:

```tsx
import type { Restaurant } from "@/lib/decision/types";
import { priceLabel, mapsUrl } from "@/lib/restaurant-format";

interface Props {
  restaurant: Restaurant;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}

export function RestaurantCard({ restaurant, selectable = false, selected = false, onToggle }: Props) {
  const url = mapsUrl(restaurant.name, restaurant.placeId);

  return (
    <div className={`ticket p-4 ${selectable && selected ? "ring-2 ring-herb" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 font-display text-lg font-bold leading-tight">{restaurant.name}</h2>
        {selectable && (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            aria-label={selected ? `Remove ${restaurant.name} from vote` : `Add ${restaurant.name} to vote`}
            className="tile-sm tile-press shrink-0 bg-herb/15 px-2 py-1 text-sm font-bold text-herb-ink"
          >
            {selected ? "✓ Added" : "+ Vote"}
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-xs font-medium">
        <span className="rounded-full border-[1.5px] border-ink bg-paper-2 px-2 py-0.5">
          {restaurant.rating !== null ? `★ ${restaurant.rating}` : "No rating"}
        </span>
        {restaurant.priceLevel !== null && (
          <span className="rounded-full border-[1.5px] border-ink bg-paper-2 px-2 py-0.5">
            {priceLabel(restaurant.priceLevel)}
          </span>
        )}
        {restaurant.openNow === true && (
          <span className="rounded-full border-[1.5px] border-ink bg-herb/20 px-2 py-0.5 text-herb-ink">
            Open now
          </span>
        )}
        {restaurant.openNow === false && (
          <span className="rounded-full border-[1.5px] border-ink bg-tomato/15 px-2 py-0.5 text-tomato-ink">
            Closed
          </span>
        )}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="tile-sm tile-press mt-3 inline-flex w-fit items-center gap-1 bg-tomato px-3 py-1.5 text-sm font-bold text-ink"
      >
        Directions →
      </a>
    </div>
  );
}
```

- [ ] **Step 8: Run the full card + format suite to verify all pass**

Run: `npx vitest run src/components/RestaurantCard.test.tsx src/lib/restaurant-format.test.ts`
Expected: PASS (original 3 card tests + 3 new card tests + 3 format tests). The exact-URL test still passes because `mapsUrl` reproduces the original string.

- [ ] **Step 9: Commit**

```bash
git add src/lib/restaurant-format.ts src/lib/restaurant-format.test.ts src/components/RestaurantCard.tsx src/components/RestaurantCard.test.tsx
git commit -m "feat: extract restaurant-format helpers and add selectable RestaurantCard"
```

---

### Task 4: Browse multi-select + Vote-with-team bar

**Files:**
- Modify: `src/components/BrowseView.tsx`
- Modify: `src/components/BrowseView.test.tsx` (append selection tests)
- Modify: `src/app/browse/page.tsx` (wire draft save + navigation)

**Interfaces:**
- Consumes: `RestaurantCard` selectable props (Task 3); `Restaurant` from `@/lib/decision/types`.
- Produces: `BrowseView` gains optional prop `onVoteWithTeam?: (picks: Restaurant[]) => void`. When provided, cards become selectable and a sticky action bar appears.

- [ ] **Step 1: Write the failing selection tests**

Append to `src/components/BrowseView.test.tsx` (inside the existing `describe`):

```tsx
  it("starts a vote with the selected restaurants", async () => {
    const loader = vi.fn().mockResolvedValue([
      r({ placeId: "a", name: "Alpha" }), r({ placeId: "b", name: "Beta" }),
    ]);
    const onVoteWithTeam = vi.fn();
    render(<BrowseView loadRestaurants={loader} origin={origin} autoStartCoords={origin} onVoteWithTeam={onVoteWithTeam} />);
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByRole("button", { name: /add alpha to vote/i }));
    await userEvent.click(screen.getByRole("button", { name: /add beta to vote/i }));
    await userEvent.click(screen.getByRole("button", { name: /vote with team/i }));
    expect(onVoteWithTeam).toHaveBeenCalledWith([
      expect.objectContaining({ placeId: "a" }),
      expect.objectContaining({ placeId: "b" }),
    ]);
  });

  it("disables the vote bar until two are selected", async () => {
    const loader = vi.fn().mockResolvedValue([
      r({ placeId: "a", name: "Alpha" }), r({ placeId: "b", name: "Beta" }),
    ]);
    render(<BrowseView loadRestaurants={loader} origin={origin} autoStartCoords={origin} onVoteWithTeam={vi.fn()} />);
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByRole("button", { name: /add alpha to vote/i }));
    expect(screen.getByRole("button", { name: /pick 2\+ to vote/i })).toBeDisabled();
  });

  it("shows no select buttons when onVoteWithTeam is absent", async () => {
    const loader = vi.fn().mockResolvedValue([r({ placeId: "a", name: "Alpha" })]);
    render(<BrowseView loadRestaurants={loader} origin={origin} autoStartCoords={origin} />);
    await screen.findByText("Alpha");
    expect(screen.queryByRole("button", { name: /to vote/i })).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify the new tests fail**

Run: `npx vitest run src/components/BrowseView.test.tsx`
Expected: FAIL — "add alpha to vote" button not found.

- [ ] **Step 3: Implement selection in BrowseView**

Replace the entire contents of `src/components/BrowseView.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { LatLng, Restaurant } from "@/lib/decision/types";
import { applyFilters, type FilterCriteria } from "@/lib/decision/filter";
import { RestaurantCard } from "@/components/RestaurantCard";
import { FilterControls } from "@/components/FilterControls";
import { BackHome } from "@/components/BackHome";

const MAX_SELECTED = 50;

interface Props {
  loadRestaurants: (coords: LatLng) => Promise<Restaurant[]>;
  origin: LatLng;
  autoStartCoords?: LatLng;
  onVoteWithTeam?: (picks: Restaurant[]) => void;
}

export function BrowseView({ loadRestaurants, origin, autoStartCoords, onVoteWithTeam }: Props) {
  const [pool, setPool] = useState<Restaurant[]>([]);
  const [criteria, setCriteria] = useState<FilterCriteria>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const toggle = useCallback((placeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else if (next.size < MAX_SELECTED) next.add(placeId);
      return next;
    });
  }, []);

  const startVote = useCallback(() => {
    if (!onVoteWithTeam) return;
    onVoteWithTeam(pool.filter((rst) => selectedIds.has(rst.placeId)));
  }, [onVoteWithTeam, pool, selectedIds]);

  if (status === "loading")
    return (
      <main className="placemat flex min-h-screen flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-5xl">🔍</p>
        <p className="font-display text-xl font-bold">Finding places near you…</p>
      </main>
    );
  if (status === "error")
    return (
      <main className="placemat flex min-h-screen flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-5xl">😕</p>
        <p className="font-display text-xl font-bold">Something went wrong. Please try again.</p>
      </main>
    );

  const selectable = !!onVoteWithTeam;
  const count = selectedIds.size;

  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
      <div className="flex items-center justify-between">
        <BackHome />
        <span className="font-mono text-xs text-ink-soft">{filtered.length} spots</span>
      </div>
      <h1 className="font-display text-2xl font-extrabold leading-tight">Browse nearby</h1>
      <FilterControls value={criteria} onChange={setCriteria} />
      {filtered.length === 0 ? (
        <p className="tile bg-white p-4 text-center text-ink-soft">
          No restaurants match these filters. Try relaxing them.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((rst) => (
            <RestaurantCard
              key={rst.placeId}
              restaurant={rst}
              selectable={selectable}
              selected={selectedIds.has(rst.placeId)}
              onToggle={() => toggle(rst.placeId)}
            />
          ))}
        </div>
      )}

      {selectable && count > 0 && (
        <div className="sticky bottom-4 mt-2">
          <button
            type="button"
            onClick={startVote}
            disabled={count < 2}
            className="tile tile-press w-full bg-herb px-4 py-3 text-center font-display text-lg font-bold text-ink disabled:opacity-60"
          >
            {count < 2 ? "Pick 2+ to vote" : `🗳️ Vote with team (${count})`}
          </button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run BrowseView tests to verify they pass**

Run: `npx vitest run src/components/BrowseView.test.tsx`
Expected: PASS (2 original + 3 new).

- [ ] **Step 5: Wire the browse page to save the draft and navigate**

Replace the entire contents of `src/app/browse/page.tsx`:

```tsx
"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BrowseView } from "@/components/BrowseView";
import { StatusScreen } from "@/components/StatusScreen";
import { useGeolocation } from "@/hooks/useGeolocation";
import { fetchNearbyRestaurants } from "@/lib/api/nearby-client";
import { saveDraft } from "@/lib/vote/draft";
import { toSnapshot } from "@/lib/vote/snapshot";
import type { LatLng, Restaurant } from "@/lib/decision/types";

export default function BrowsePage() {
  const { coords, error, request } = useGeolocation();
  const router = useRouter();
  useEffect(() => {
    request();
  }, [request]);

  const loader = useCallback((c: LatLng) => fetchNearbyRestaurants(c.lat, c.lng, 1500), []);

  const onVoteWithTeam = useCallback(
    (picks: Restaurant[]) => {
      saveDraft(picks.map((r) => ({ name: r.name, placeId: r.placeId, snapshot: toSnapshot(r) })));
      router.push("/vote?from=browse");
    },
    [router],
  );

  if (error) return <StatusScreen emoji="📍" text={error} />;
  if (!coords) return <StatusScreen emoji="📍" text="Requesting your location…" />;

  return <BrowseView loadRestaurants={loader} origin={coords} autoStartCoords={coords} onVoteWithTeam={onVoteWithTeam} />;
}
```

- [ ] **Step 6: Verify the project still type-checks and the browse suite passes**

Run: `npx vitest run src/components/BrowseView.test.tsx && npx tsc --noEmit`
Expected: tests PASS; `tsc` prints nothing (no type errors).

- [ ] **Step 7: Commit**

```bash
git add src/components/BrowseView.tsx src/components/BrowseView.test.tsx src/app/browse/page.tsx
git commit -m "feat: select restaurants in Browse and start a team vote"
```

---

### Task 5: Pre-fill the Quick-vote form from the draft

**Files:**
- Modify: `src/components/QuickVoteForm.tsx`
- Modify: `src/components/QuickVoteForm.test.tsx` (update existing assertion + add tests)
- Modify: `src/app/vote/page.tsx` (load draft → initialOptions; map options to POST body)

**Interfaces:**
- Consumes: `loadDraft`, `clearDraft` from `@/lib/vote/draft`.
- Produces:
  - `interface VoteOptionInput { name: string; placeId?: string | null; snapshot?: unknown }`
  - `QuickVoteForm` props: `onCreate(hostName: string, options: VoteOptionInput[]): Promise<void>` and new optional `initialOptions?: VoteOptionInput[]`.

- [ ] **Step 1: Update the existing test and add new ones**

Edit `src/components/QuickVoteForm.test.tsx`. Change the assertion on the first test (was `["Sushi", "Pizza"]`) to objects, and add two tests:

```tsx
  it("submits trimmed host name and non-empty options", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<QuickVoteForm onCreate={onCreate} />);
    await userEvent.type(screen.getByLabelText(/your name/i), "Sam");
    const optionInputs = screen.getAllByLabelText(/option/i);
    await userEvent.type(optionInputs[0], "Sushi");
    await userEvent.type(optionInputs[1], "Pizza");
    await userEvent.click(screen.getByRole("button", { name: /start vote/i }));
    expect(onCreate).toHaveBeenCalledWith("Sam", [{ name: "Sushi" }, { name: "Pizza" }]);
  });

  it("includes pre-filled restaurant picks in the payload", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const initialOptions = [
      { name: "Alpha", placeId: "a", snapshot: { placeId: "a", name: "Alpha" } },
      { name: "Beta", placeId: "b", snapshot: { placeId: "b", name: "Beta" } },
    ];
    render(<QuickVoteForm onCreate={onCreate} initialOptions={initialOptions} />);
    await userEvent.type(screen.getByLabelText(/your name/i), "Sam");
    await userEvent.click(screen.getByRole("button", { name: /start vote/i }));
    expect(onCreate).toHaveBeenCalledWith("Sam", initialOptions);
  });

  it("removing a pre-filled pick can drop below the 2-option minimum", async () => {
    const onCreate = vi.fn();
    const initialOptions = [
      { name: "Alpha", placeId: "a", snapshot: { placeId: "a", name: "Alpha" } },
      { name: "Beta", placeId: "b", snapshot: { placeId: "b", name: "Beta" } },
    ];
    render(<QuickVoteForm onCreate={onCreate} initialOptions={initialOptions} />);
    await userEvent.type(screen.getByLabelText(/your name/i), "Sam");
    await userEvent.click(screen.getByRole("button", { name: /remove beta/i }));
    await userEvent.click(screen.getByRole("button", { name: /start vote/i }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 2 options/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/QuickVoteForm.test.tsx`
Expected: FAIL — first test now expects objects (impl still emits strings); "remove beta" button not found.

- [ ] **Step 3: Rewrite QuickVoteForm**

Replace the entire contents of `src/components/QuickVoteForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { BackHome } from "@/components/BackHome";

export interface VoteOptionInput {
  name: string;
  placeId?: string | null;
  snapshot?: unknown;
}

interface Props {
  onCreate: (hostName: string, options: VoteOptionInput[]) => Promise<void>;
  initialOptions?: VoteOptionInput[];
}

export function QuickVoteForm({ onCreate, initialOptions }: Props) {
  const [hostName, setHostName] = useState("");
  const [picks, setPicks] = useState<VoteOptionInput[]>(initialOptions ?? []);
  const [texts, setTexts] = useState<string[]>((initialOptions?.length ?? 0) >= 2 ? [] : ["", ""]);
  const [error, setError] = useState<string | null>(null);

  const setText = (i: number, val: string) =>
    setTexts((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  const removePick = (i: number) =>
    setPicks((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    const filledTexts: VoteOptionInput[] = texts.map((o) => o.trim()).filter(Boolean).map((name) => ({ name }));
    const all = [...picks, ...filledTexts];
    if (!hostName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (all.length < 2) {
      setError("Add at least 2 options.");
      return;
    }
    setError(null);
    await onCreate(hostName.trim(), all);
  };

  return (
    <main className="placemat mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 py-8">
      <BackHome />
      <header>
        <h1 className="font-display text-3xl font-extrabold leading-tight">Quick group vote</h1>
        <p className="mt-1 text-sm text-ink-soft">Throw out the options — settle it together.</p>
      </header>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Your name
        <input
          className="tile-sm bg-white px-3 py-2 font-medium outline-none"
          placeholder="e.g. Alex"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
        />
      </label>

      {picks.length > 0 && (
        <div className="flex flex-col gap-2">
          {picks.map((p, i) => (
            <div key={`${p.placeId ?? "pick"}-${i}`} className="tile-sm flex items-center justify-between gap-2 bg-paper-2 px-3 py-2">
              <span className="min-w-0 truncate font-display font-bold">{p.name}</span>
              <button
                type="button"
                onClick={() => removePick(i)}
                aria-label={`Remove ${p.name}`}
                className="shrink-0 font-mono text-sm font-bold text-tomato-ink"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {texts.map((o, i) => (
        <label key={i} className="flex flex-col gap-1 text-sm font-semibold">
          {`Option ${i + 1}`}
          <input
            className="tile-sm bg-white px-3 py-2 font-medium outline-none"
            placeholder={i === 0 ? "Sushi place" : i === 1 ? "That noodle spot" : "Another option"}
            value={o}
            onChange={(e) => setText(i, e.target.value)}
          />
        </label>
      ))}

      <button
        type="button"
        onClick={() => setTexts((p) => [...p, ""])}
        className="self-start font-mono text-sm font-bold text-tomato-ink"
      >
        + Add option
      </button>

      {error && (
        <p className="tile-sm bg-tomato/15 px-3 py-2 text-sm font-semibold text-tomato-ink">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        className="tile tile-press mt-1 bg-herb px-4 py-3 font-display text-lg font-bold text-ink"
      >
        Start vote
      </button>
    </main>
  );
}
```

- [ ] **Step 4: Run QuickVoteForm tests to verify they pass**

Run: `npx vitest run src/components/QuickVoteForm.test.tsx`
Expected: PASS (1 updated + 1 existing "fewer than 2" + 2 new). Note the existing "fewer than 2" test still works: with no `initialOptions`, `texts` starts `["", ""]`, one filled → `all.length` 1 → error.

- [ ] **Step 5: Wire the vote entry page to consume the draft**

Replace the entire contents of `src/app/vote/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QuickVoteForm, type VoteOptionInput } from "@/components/QuickVoteForm";
import { StatusScreen } from "@/components/StatusScreen";
import { loadDraft, clearDraft } from "@/lib/vote/draft";

export default function VoteEntryPage() {
  const router = useRouter();
  const [initialOptions, setInitialOptions] = useState<VoteOptionInput[]>([]);
  const [ready, setReady] = useState(false);
  const consumed = useRef(false);

  // Consume the Browse handoff once, on the client, AFTER mount. Reading +
  // clearing sessionStorage in an effect (never a render-time initializer)
  // keeps SSR hydration stable — server and first client render both show the
  // gate — and the `consumed` ref makes it survive React Strict Mode's
  // double-invoke (the second pass would otherwise read empty after the first
  // cleared, dropping the draft).
  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;
    const draft = loadDraft();
    clearDraft();
    setInitialOptions(draft.map((d) => ({ name: d.name, placeId: d.placeId, snapshot: d.snapshot })));
    setReady(true);
  }, []);

  const onCreate = async (hostName: string, options: VoteOptionInput[]) => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostName,
        options: options.map((o) => ({ name: o.name, placeId: o.placeId ?? null, snapshot: o.snapshot ?? null })),
      }),
    });
    if (!res.ok) return;
    const { sessionId, hostToken } = (await res.json()) as { sessionId: string; hostToken: string };
    if (typeof window !== "undefined") {
      localStorage.setItem(`whattoeat:host:${sessionId}`, hostToken);
      // Remember the creator's name so they land in the room already joined.
      localStorage.setItem(`whattoeat:name:${sessionId}`, hostName);
    }
    router.push(`/vote/${sessionId}`);
  };

  // One-tick gate while the draft is consumed; also the SSR/first-client paint.
  if (!ready) return <StatusScreen emoji="🍽️" text="Setting up your vote…" />;

  return <QuickVoteForm onCreate={onCreate} initialOptions={initialOptions} />;
}
```

- [ ] **Step 6: Type-check and confirm the existing vote E2E still passes its create path**

Run: `npx tsc --noEmit`
Expected: no output (the `vote.spec.ts` "host creates a vote" flow is unaffected — with no draft, the form behaves exactly as before).

- [ ] **Step 7: Commit**

```bash
git add src/components/QuickVoteForm.tsx src/components/QuickVoteForm.test.tsx src/app/vote/page.tsx
git commit -m "feat: pre-fill the Quick-vote form from a Browse handoff draft"
```

---

### Task 6: Render restaurant snapshots in the vote room

**Files:**
- Modify: `src/components/VoteRoom.tsx`
- Modify: `src/components/VoteRoom.test.tsx` (append snapshot tests)

**Interfaces:**
- Consumes: `parseSnapshot` from `@/lib/vote/snapshot`; `priceLabel`, `mapsUrl` from `@/lib/restaurant-format`. `VoteOption.snapshot` is `unknown` (already returned by the GET route).

- [ ] **Step 1: Write the failing snapshot tests**

Append to `src/components/VoteRoom.test.tsx` (inside the `describe`):

```tsx
  it("renders restaurant details for options that carry a snapshot", () => {
    const richOptions: VoteOption[] = [
      { id: "o1", sessionId: "s1", placeId: "a", name: "Sushi",
        snapshot: { placeId: "a", name: "Sushi", rating: 4.6, priceLevel: 2, lat: 0, lng: 0, openNow: true, photoRef: null } },
      { id: "o2", sessionId: "s1", placeId: null, name: "Pizza", snapshot: null },
    ];
    render(<VoteRoom sessionId="s1" initialSession={session} options={richOptions} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.getByText("★ 4.6")).toBeInTheDocument();
    // Directions link only appears for the option that has a snapshot.
    expect(screen.getAllByRole("link", { name: /directions/i })).toHaveLength(1);
  });

  it("falls back to name-only for options without a snapshot", () => {
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.queryByRole("link", { name: /directions/i })).toBeNull();
    expect(screen.getByText("Sushi")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/VoteRoom.test.tsx`
Expected: FAIL — no "★ 4.6" text / no Directions link rendered yet.

- [ ] **Step 3: Add snapshot rendering to VoteRoom**

In `src/components/VoteRoom.tsx`, add these imports below the existing import block (after line 7's `BackHome` import):

```tsx
import { parseSnapshot } from "@/lib/vote/snapshot";
import { priceLabel, mapsUrl } from "@/lib/restaurant-format";
```

Then, inside the `options.map((o) => ( ... ))` block, insert the snapshot detail **between** the name/tally `<div className="flex items-center justify-between gap-2">…</div>` and the `{!closed && ( …vote buttons… )}` block. The option `<div key={o.id} className="tile bg-white p-4">` body becomes:

```tsx
          <div key={o.id} className="tile bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-display text-lg font-bold">{o.name}</span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-sm font-semibold">
                <span data-testid={`up-${o.id}`}>👍 {tally[o.id]?.up ?? 0}</span>
                <span data-testid={`veto-${o.id}`}>🚫 {tally[o.id]?.veto ?? 0}</span>
              </span>
            </div>
            {(() => {
              const snap = parseSnapshot(o.snapshot);
              if (!snap) return null;
              return (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-xs font-medium">
                  {snap.rating !== null && (
                    <span className="rounded-full border-[1.5px] border-ink bg-paper-2 px-2 py-0.5">
                      {`★ ${snap.rating}`}
                    </span>
                  )}
                  {snap.priceLevel !== null && (
                    <span className="rounded-full border-[1.5px] border-ink bg-paper-2 px-2 py-0.5">
                      {priceLabel(snap.priceLevel)}
                    </span>
                  )}
                  {snap.openNow === true && (
                    <span className="rounded-full border-[1.5px] border-ink bg-herb/20 px-2 py-0.5 text-herb-ink">
                      Open now
                    </span>
                  )}
                  <a
                    href={mapsUrl(snap.name, snap.placeId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-tomato-ink underline"
                  >
                    Directions →
                  </a>
                </div>
              );
            })()}
            {!closed && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onCast(o.id, "up")}
                  aria-label={`Upvote ${o.name}`}
                  className="tile-sm tile-press flex-1 bg-herb/15 py-2 text-sm font-bold text-herb-ink"
                >
                  👍 Up
                </button>
                <button
                  onClick={() => onCast(o.id, "veto")}
                  aria-label={`Veto ${o.name}`}
                  className="tile-sm tile-press flex-1 bg-tomato/15 py-2 text-sm font-bold text-tomato-ink"
                >
                  🚫 Veto
                </button>
              </div>
            )}
          </div>
```

- [ ] **Step 4: Run VoteRoom tests to verify they pass**

Run: `npx vitest run src/components/VoteRoom.test.tsx`
Expected: PASS (5 original + 2 new). The original closed/winner/tally tests use `snapshot: null` → no detail row → unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/VoteRoom.tsx src/components/VoteRoom.test.tsx
git commit -m "feat: show restaurant snapshot details in the vote room"
```

---

### Task 7: End-to-end Browse → team vote

**Files:**
- Create: `e2e/vote-with-team.spec.ts`

**Interfaces:**
- Consumes: routes `/browse`, `/vote`, `/vote/[id]`; APIs `/api/nearby`, `/api/sessions`, `/api/sessions/:id` (all mocked via `page.route`). Geolocation granted via `test.use`.

- [ ] **Step 1: Write the E2E spec**

Create `e2e/vote-with-team.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const NEARBY = {
  restaurants: [
    { placeId: "p-alpha", name: "Alpha Diner", rating: 4.6, priceLevel: 2, lat: 1.29, lng: 103.85, openNow: true, types: ["restaurant"], photoRef: null },
    { placeId: "p-beta", name: "Beta Bistro", rating: 4.2, priceLevel: 3, lat: 1.29, lng: 103.85, openNow: true, types: ["restaurant"], photoRef: null },
  ],
};

const SESSION = {
  session: { id: "team-1", hostName: "Sam", status: "open", winnerOptionId: null, expiresAt: "" },
  options: [
    { id: "o1", sessionId: "team-1", placeId: "p-alpha", name: "Alpha Diner",
      snapshot: { placeId: "p-alpha", name: "Alpha Diner", rating: 4.6, priceLevel: 2, lat: 1.29, lng: 103.85, openNow: true, photoRef: null } },
    { id: "o2", sessionId: "team-1", placeId: "p-beta", name: "Beta Bistro",
      snapshot: { placeId: "p-beta", name: "Beta Bistro", rating: 4.2, priceLevel: 3, lat: 1.29, lng: 103.85, openNow: true, photoRef: null } },
  ],
  votes: [],
};

test.use({ permissions: ["geolocation"], geolocation: { latitude: 1.29, longitude: 103.85 } });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/nearby", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(NEARBY) }));
  await page.route("**/api/sessions", (route) =>
    route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ sessionId: "team-1", hostToken: "host-token-team" }) }));
  await page.route("**/api/sessions/team-1", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SESSION) }));
});

test("browse → select restaurants → start a team vote with rich option cards", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByText("Alpha Diner")).toBeVisible();

  await page.getByRole("button", { name: /add alpha diner to vote/i }).click();
  await page.getByRole("button", { name: /add beta bistro to vote/i }).click();
  await page.getByRole("button", { name: /vote with team/i }).click();

  // Pre-filled vote form shows the picks; host names themselves.
  await expect(page.getByText("Alpha Diner")).toBeVisible();
  await page.getByLabel(/your name/i).fill("Sam");
  await page.getByRole("button", { name: /start vote/i }).click();

  // Room renders rich cards from the snapshot.
  await expect(page.getByText("★ 4.6")).toBeVisible();
  await expect(page.getByRole("link", { name: /directions/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /copy link/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the new E2E spec**

Run: `npx playwright test e2e/vote-with-team.spec.ts`
Expected: PASS (1 test, project "mobile"). The dev server is started/reused automatically per `playwright.config.ts`.

- [ ] **Step 3: Run the full E2E suite to confirm no regressions**

Run: `npm run e2e`
Expected: PASS — the existing `vote.spec.ts` (2 tests) + the new spec (1 test).

- [ ] **Step 4: Commit**

```bash
git add e2e/vote-with-team.spec.ts
git commit -m "test: e2e for Browse-to-team-vote handoff"
```

---

### Task 8: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the entire unit suite**

Run: `npm test`
Expected: PASS — all prior tests plus the new `snapshot`, `draft`, `restaurant-format`, and the appended component tests. (Was 85 unit tests; this adds ~19.)

- [ ] **Step 2: Lint and type-check**

Run: `npm run lint && npx tsc --noEmit`
Expected: lint clean; `tsc` no output.

- [ ] **Step 3: Production build sanity**

Run: `npm run build`
Expected: build succeeds (no type or route errors).

- [ ] **Step 4: Commit any incidental fixes**

If lint/build surfaced fixes, commit them:

```bash
git add -A
git commit -m "chore: lint and type-check fixes for vote-with-team"
```

(If there were no changes, skip this commit.)

---

## Self-Review

**1. Spec coverage**

| Spec item | Task |
|-----------|------|
| Browse multi-select (tick 2–50) | Task 3 (selectable card) + Task 4 (BrowseView selection, cap 50, min 2) |
| Sticky "Vote with team (N)" bar | Task 4 |
| Pre-fill the Quick-vote form | Task 5 |
| Carry `name`+`placeId`+`snapshot` | Task 1 (`toSnapshot`) + Task 4 (page `saveDraft`) + Task 5 (POST mapping) |
| `sessionStorage` transport + guard | Task 2 (`draft.ts`) |
| Rich room cards + name-only fallback | Task 6 |
| No backend/API/DB changes | Honored — only `src/lib`, `src/components`, `src/app/{browse,vote}/page.tsx`, `e2e/` touched |
| Validation at boundaries | Task 1 `parseSnapshot`, Task 2 `loadDraft` |
| Existing strings/tests preserved | Task 3/6 keep `data-testid`/`aria-label`; Task 5 updates the one intentional contract change |
| ≥80% coverage via TDD | Tasks 1–7 are test-first |
| E2E with `/api/nearby` mocked | Task 7 |

No gaps.

**2. Placeholder scan:** No TBD/TODO/"add error handling"/"similar to" — every code step shows complete code. ✅

**3. Type consistency:**
- `RestaurantSnapshot` defined in Task 1, imported by Tasks 2 & 6. ✅
- `DraftOption` (Task 2) consumed by `browse/page.tsx` (Task 4) and produced into `VoteOptionInput` (Task 5). The page maps `DraftOption → VoteOptionInput` explicitly. ✅
- `VoteOptionInput` defined+exported in Task 5 (`QuickVoteForm.tsx`), imported by `vote/page.tsx`. ✅
- `onVoteWithTeam: (picks: Restaurant[]) => void` — same signature in BrowseView (Task 4) and browse/page.tsx (Task 4). ✅
- `mapsUrl`/`priceLabel` signatures identical across Tasks 3 & 6. ✅
- `onCreate(hostName, options: VoteOptionInput[])` — consistent in QuickVoteForm, its tests, and vote/page.tsx. ✅

No inconsistencies found.
