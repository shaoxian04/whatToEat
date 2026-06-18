# whatToEat — Design Spec

**Date:** 2026-06-18
**Status:** Approved (pending spec review)
**Author:** shaoxian04 + Claude

## Problem

Two colleagues (and potentially a small team) waste time every lunch deciding
where to eat. They know several nearby restaurants but suffer decision paralysis.
Ranked pain points:

1. **Deciding** (primary) — can't pick from known options
2. **Discovering** (secondary) — forgetting/refreshing what's nearby
3. **Group consensus** (tertiary) — aligning between people with different tastes

## Goal

A mobile-friendly web app that helps a user (and optionally their colleagues)
go from "I don't know what to eat" to a decision in seconds — via a random pick,
a filtered browse, or a quick group vote.

## Non-Goals (explicitly cut from v1)

These are deliberately excluded to keep v1 finishable. Several are "designed for,
not built" — the data model leaves room, but no UI/logic ships in v1.

- Social-media reviews (Instagram/TikTok/etc.) — no viable public API; out of scope
- User accounts / login — **schema-ready** (`sessions.user_id` nullable) but not built
- Saved favorites / decision history
- Saved office location — v1 uses live GPS only
- Native mobile app — web only
- "Smart" weighted picks (e.g. "you had Thai yesterday") — engine is structured to
  allow it later, but v1 random is uniform
- Monetization features — v1 is a free tool; revenue paths (B2B office tool, local
  restaurant promos) are a future, separate exploration

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Priority | Decide > Discover > Group consensus | Matches user's ranked pain |
| Platform | Mobile-friendly web app (PWA-capable) | Fastest to ship, share via link, no app store, easiest to monetize later |
| Data source | Google Places API (New) | Real ratings/price/distance; generous free tier |
| Build stack | Next.js + Supabase, deployed on Vercel | Next.js hides API key + serves UI; Supabase gives Postgres + Realtime + future Auth |
| Groups | Link-to-vote, no accounts (accounts-ready) | Zero signup friction; viral; future-proofed |
| Location | Device GPS, with manual fallback | Works anywhere; manual entry if permission denied |

## Architecture

```
Browser (Next.js React UI, mobile-first)
  - Geolocation -> lat/lng
  - Three entry modes + vote screen
        |  (Google API key NEVER reaches the browser)
Next.js API routes (server-side)
  - /api/nearby   -> proxies Google Places (hides key, rate-limited)
  - /api/sessions -> create/read vote sessions
  - /api/votes    -> cast votes
        |                         |
Google Places API (New)      Supabase
  nearby search                - Postgres (sessions, options, votes)
                               - Realtime (live vote tally)
                               - Auth (LATER, not v1)
```

**Security boundary:** the Google API key lives only in server-side env vars and
is used only by `/api/nearby`. It is never sent to the client.

## Home Page — Three Entry Modes

```
        whatToEat
  🎲  Surprise me          -> random pick from nearby (Google)
  🔍  Browse restaurants   -> filter nearby (Google), then pick or start vote
  ✍️  Quick group vote      -> type your own options, vote instantly (no Google/GPS needed)
```

All three modes converge on the **same** group-vote screen when voting is chosen,
because the voting engine is decoupled from where options originate.

## Screens & Flow

1. **Home** — location prompt → three mode buttons (above)
2. **Surprise me (Mode B)** — animated pick lands on one place →
   *Pick again* / *Let's go here* / *Vote with team*
3. **Browse/Filter (Mode A)** — set distance · price · min rating · cuisine · open-now
   → results list → pick one or *Start a vote* from a shortlist
4. **Quick vote (Mode C)** — add free-text options → *Start vote* → group-vote screen
5. **Restaurant card** — name, rating, price, distance, open-now, photo,
   "Directions" (opens Google Maps)
6. **Group vote** — shareable link → participants open it, type their name,
   **upvote / veto** → **live tally** → winner 🏆

## Data Model (Supabase / Postgres)

**`sessions`**
- `id` (uuid, pk)
- `created_at`
- `host_name` (text)
- `location` (lat/lng, nullable — null for Quick-vote sessions)
- `status` (enum: open | closed)
- `winner_option_id` (nullable fk)
- `expires_at`
- `user_id` (nullable — accounts hook for later)

**`session_options`**
- `id` (uuid, pk)
- `session_id` (fk)
- `place_id` (text, **nullable** — null for free-text Quick-vote options)
- `name` (text)
- `snapshot` (jsonb — stored copy of rating/price/distance/photo so the vote is
  stable even if Google's data changes; arbitrary for free-text options)

**`votes`**
- `id` (uuid, pk)
- `session_id` (fk)
- `option_id` (fk)
- `voter_name` (text)
- `type` (enum: up | veto)
- `created_at`
- Unique constraint: `(session_id, option_id, voter_name)` — one vote per person per option

**Row Level Security:** anon access scoped so participants can only read/write
within a session they hold the link/id for.

## Decision Engine

- **Random pick:** uniform random from the current pool (all nearby, or the
  filtered subset), with a light "don't repeat the immediately previous pick" rule.
  Structured to allow weighted/"smart" picks later (cut from v1).
- **Filters:** distance radius, price level (1–4), minimum rating, cuisine type,
  open-now.
- **Winner logic:** most upvotes wins; a veto eliminates an option; ties resolved
  by random tiebreak among the leaders.

## Realtime Voting

Participants subscribe to the session's votes via **Supabase Realtime**. A new vote
broadcasts and every participant's tally updates instantly (no refresh). The host
taps "Close voting" → status flips to `closed` → winner is computed and locked in.

## Error Handling

| Case | Behavior |
|------|----------|
| Location permission denied | Fall back to manual "enter your area" search box; Quick-vote mode still fully works |
| No restaurants found | Prompt to widen distance / lower rating |
| Google quota / API error | Friendly retry message; never expose raw error |
| Bad / expired vote link | Clear "this lunch vote has ended" message |
| Network offline | Use last cached results where possible |
| API cost control | Rate-limit `/api/nearby` to keep Google billing near $0 |

## Testing

- **Unit:** decision engine — random pick, filter logic, winner calculation
- **Integration:** API routes with Google + Supabase mocked
- **E2E (Playwright):** the two flows that matter most —
  1. solo random pick
  2. create vote → second participant votes → winner declared

## Open Questions / Future

- Accounts + persistent saved groups (schema already supports `user_id`)
- "Smart" weighted picks using recent history
- Saved office location as a GPS alternative
- Monetization exploration (B2B office tool is the most promising angle)
