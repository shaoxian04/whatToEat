# whatToEat

Mobile-friendly web app that helps you decide where to eat — random pick or filtered browse of nearby restaurants (Google Places). Plus group voting.

## Setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and set `GOOGLE_PLACES_API_KEY`
   (enable "Places API (New)" in Google Cloud; a billing account is required even for the free tier).
3. `npm run dev` → open http://localhost:3000 on your phone or browser.

## Testing

- `npm test` — unit + component tests (Vitest)
- `npm run e2e` — end-to-end tests (Playwright)

## Notes

- The Google API key is used only server-side (`/api/nearby`, `/api/photo`, `/api/area`). Never expose it to the client.
- If location is denied, Browse/Surprise offer an area search (Places Text Search).
- Nearby results (5 min), photo URLs (1 h) and area lookups (1 day) are cached in-process to cut billed calls.

## Group voting (Plan 2)

### Requirements

A Supabase project is required. Set the following environment variables in `.env.local`:

| Variable | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Public — safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Public — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Secret — **never** use a `NEXT_PUBLIC_` prefix |

### Database setup

Apply the migrations to your Supabase project:

```
supabase db push
```

or run `supabase/migrations/0001_group_voting.sql` then `0002_hardening.sql` in the Supabase SQL editor.
`0002` is required by the current code (it adds the `create_vote_session` function and `votes.voter_id`).

Realtime is not used: the vote room polls `/api/sessions/<id>` every 3s while the tab is visible.

### Usage

1. Open `/vote` to create a vote session and choose your food options.
2. Share the `/vote/<id>` link with your group.
3. Each person upvotes any options they'd be happy with (one vote per option).
4. Results refresh every few seconds; the host closes the vote to reveal the winner (ties and no-vote closes are picked at random, and the room says so).
5. Votes expire after a day; sessions expired for over a week are cleaned up when new ones are created.

### Security model

- All reads and writes go through server API routes that use the **service-role key**, which bypasses Row Level Security (RLS). Browsers never talk to Supabase directly.
- RLS is enabled on every table with **no** anon policies, so the anon key cannot list sessions or voter names.
- Each browser gets a random voter id (localStorage). A name belongs to the first browser that votes with it in a session, which stops casual impersonation; voter ids are never returned to clients.
- Host tokens are stored in `session_secrets`, which has RLS enabled with no anon policies **and** `REVOKE ALL … FROM anon, authenticated` as defense in depth. The anon key can never read host tokens.

## Smart recommendations

Restaurants are ranked by a **smart score**, not raw Google rating:

- **Review-count-weighted rating** (Bayesian) so a place with 4.9 from 12 reviews
  doesn't outrank a 4.5 from 3,000.
- Combined with **distance** (closer is better) and **open-now**.
- Powers **Browse** ordering, the **Surprise** pick (weighted random), and the
  **"Vote with top picks"** group-vote shortcut.

Weights live in `src/lib/decision/score.ts` (`DEFAULT_SCORE_CONFIG`) and are easy to tune.
Only Google signals are used today; the engine is source-agnostic for future sources.
