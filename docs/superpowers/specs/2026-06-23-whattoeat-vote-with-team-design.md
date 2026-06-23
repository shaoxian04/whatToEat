# whatToEat — "Vote with team" Handoff (Plan 3) Design Spec

**Date:** 2026-06-23
**Status:** Approved (pending spec review)
**Author:** shaoxian04 + Claude

## Problem

Today the solo decision flow (Surprise, Browse) and the group-vote flow are
disconnected. A user who browses real nearby restaurants has no way to push those
picks into a group vote — they'd have to retype the names into the Quick-vote form,
losing rating/price/Directions and the whole point of having browsed real places.

This was anticipated in the v1 spec ("Browse… then pick or **start a vote** from a
shortlist") but never built. Plan 1 (Solo Decider) and Plan 2 (Group Voting) shipped
the two halves; Plan 3 connects them.

## Goal

From the **Browse** list, let a user select 2+ real restaurants and start a group
vote on exactly those — carrying each pick's identity and details so the vote room
shows real restaurant cards (rating, price, open-now, Directions), not bare names.

## Scope

**Browse multi-select → pre-fill the Quick-vote form → carry `name`+`placeId`+`snapshot`
→ rich option cards in the vote room.** Frontend-only.

### Non-Goals (explicitly cut)

- **Surprise-screen entry** — single-pick flow needs a shortlist mechanism; deferred.
  (The "Vote with team" button on Surprise from the v1 sketch is not built here.)
- **Cross-screen pick "cart"** / draft assembled across Surprise + Browse.
- **Persisting Browse selection across back-navigation** — the draft is consumed on
  load; returning to Browse starts a fresh selection.
- **Editing a restaurant pick's display name** in the form (free-text options remain
  fully editable; restaurant picks are add/remove only).

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entry point | Browse multi-select only | The list is already there; selecting 2+ maps cleanly onto the existing ≥2-options rule |
| Create flow | Pre-fill the existing Quick-vote form | Reuses the validated `POST /api/sessions` path; host can name themselves, add/remove options before starting |
| Pick richness | Carry `name` + `placeId` + `snapshot`; render rich cards in room | The backend already stores these; without them the vote is indistinguishable from a typed Quick-vote |
| Transport | `sessionStorage` draft | Snapshots are too large for query params; Next App-Router `push` cannot carry objects |
| Backend changes | **None** | Create + read already accept/return `placeId`/`snapshot`; the room already receives them |

## Architecture & Data Flow

```
Browse list ──tick 2–50──▶ sticky "Vote with team (N)" bar
      │  writes draft to sessionStorage (whattoeat:vote-draft)
      ▼
/vote?from=browse ──reads + clears draft──▶ QuickVoteForm (pre-filled)
      │  host types name, may add/remove options, "Start vote"
      ▼
POST /api/sessions  { hostName, options:[{ name, placeId, snapshot }] }   ← already supported
      ▼
/vote/[id]  VoteRoom ──renders snapshot──▶ rich option cards (rating / price / Directions)
```

**Why no backend work:** `CreateSessionInput.options` already accepts
`{ name, placeId?, snapshot? }` (`repository.ts`), the `/api/sessions` POST route
already validates and forwards `placeId` + `snapshot` (`route.ts`), `mapOption`
preserves `snapshot` on read (`supabase-repository.ts`), `GET /api/sessions/[id]`
returns the full state, and `VoteRoom` already *receives* `options` with `snapshot`
— it simply ignores it today.

## Components & Files

**New**

- `src/lib/vote/snapshot.ts` — pure helpers shared by sender and room:
  - `toSnapshot(Restaurant): RestaurantSnapshot` — trims a `Restaurant` to the fields
    the room needs (`placeId, name, rating, priceLevel, openNow, lat, lng, photoRef`).
  - `parseSnapshot(value: unknown): RestaurantSnapshot | null` — boundary guard; the
    room never trusts the stored blob (`snapshot` is typed `unknown`).
- `src/lib/vote/draft.ts` — `sessionStorage` transport:
  - `saveDraft(options: DraftOption[])`, `loadDraft(): DraftOption[]`, `clearDraft()`.
  - `DraftOption = { name: string; placeId: string; snapshot: RestaurantSnapshot }`.
  - `loadDraft` validates/drops malformed or oversized entries → returns `[]` on any
    corruption (never throws).

**Modified**

- `src/components/RestaurantCard.tsx` — add **optional** props
  `selectable?: boolean`, `selected?: boolean`, `onToggle?: () => void` (all default
  off → existing call sites unchanged). When `selectable`, expose a tap target with
  `aria-pressed={selected}`. The existing Directions link/markup is preserved.
- `src/components/BrowseView.tsx` — track a `Set<placeId>` of selections; render each
  card as `selectable`; show a sticky footer "Vote with team (N)" bar — disabled until
  N ≥ 2, capped at 50. On tap: `saveDraft(selected.map(toDraftOption))` then
  `router.push("/vote?from=browse")`.
- `src/components/QuickVoteForm.tsx` — `onCreate` signature becomes
  `(hostName: string, options: { name: string; placeId?: string | null; snapshot?: unknown }[]) => Promise<void>`;
  the internal option model becomes that same shape. New `initialOptions?` prop seeds restaurant
  picks, rendered as **removable read-only chips** (name + tiny meta); host can still add
  free-text options via the existing "+ Add option". Validation unchanged (≥2 filled,
  non-empty names).
- `src/app/vote/page.tsx` — on mount, `loadDraft()` + `clearDraft()`; pass as
  `initialOptions`. `onCreate` maps every option to `{ name, placeId, snapshot }` in the
  POST body (free-text options send `placeId: null, snapshot: null`).
- `src/components/VoteRoom.tsx` — for each option, `parseSnapshot(o.snapshot)`; when
  present, render rating/price/open-now badges + a Directions link inside the option tile
  (above the up/veto buttons). When absent, fall back to today's name-only tile. All
  existing `data-testid`/`aria-label` strings on vote controls preserved.

## Validation & Error Handling

| Case | Behavior |
|------|----------|
| Corrupt / oversized draft in storage | `loadDraft` returns `[]`; user lands on a normal blank Quick-vote form (no crash) |
| Direct nav to `/vote` with no draft | Unchanged blank form |
| < 2 restaurants selected | "Vote with team" bar disabled with a hint |
| > 50 selected | Selection capped at 50 (the API's max) |
| Snapshot size | One trimmed restaurant ≈ a few hundred bytes — well under the API's 4096-byte/option cap |
| Unknown/legacy `snapshot` shape in room | `parseSnapshot` → `null` → graceful name-only fallback |

## Testing (TDD, ≥80%)

- **Unit**
  - `snapshot.ts` — `toSnapshot` trims correctly; `parseSnapshot` accepts valid, rejects
    malformed/partial/oversized → `null`.
  - `draft.ts` — save/load round-trip; malformed and oversized storage → `[]`; clear.
  - `RestaurantCard` — selectable toggle fires `onToggle`, `aria-pressed` reflects
    `selected`; non-selectable render unchanged (back-compat).
  - `BrowseView` — select/deselect updates count; bar disabled < 2 and ≥ cap; tapping
    writes the draft and navigates.
  - `QuickVoteForm` — `initialOptions` render as chips; remove a chip; submit a mix of
    restaurant + free-text options yields the right payload.
  - `VoteRoom` — option with a valid snapshot renders rich card; option without falls
    back to name-only; vote controls/test-ids intact.
- **E2E (Playwright, `/api/nearby` mocked — no `GOOGLE_PLACES_API_KEY` locally)**
  - Browse → select 2 → vote form pre-filled → Start vote → room shows rich option cards.

## Out of Scope / Future

- Surprise-screen "Vote with team" (needs a shortlist UI).
- A persistent cross-screen pick cart.
- Photo thumbnails in option cards (snapshot already carries `photoRef`; render later).
