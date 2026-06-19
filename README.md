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

## Group voting (Plan 2)

### Requirements

A Supabase project is required. Set the following environment variables in `.env.local`:

| Variable | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Public — safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Public — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Secret — **never** use a `NEXT_PUBLIC_` prefix |

### Database setup

Apply the migration to your Supabase project:

```
supabase db push
```

or copy `supabase/migrations/0001_group_voting.sql` into the Supabase SQL editor and run it.

Then ensure Realtime is enabled for the `votes` and `sessions` tables in the Supabase dashboard (Table Editor → Replication).

### Usage

1. Open `/vote` to create a vote session and choose your food options.
2. Share the `/vote/<id>` link with your group.
3. Each person votes (up or veto) on the options.
4. The host watches live results update in real time and can close the vote to reveal the winner.

### Security model

- All writes (create session, cast vote, close session) go through server API routes that use the **service-role key**, which bypasses Row Level Security (RLS).
- Browsers receive only the **anon key** and use it for reads and Realtime subscriptions. Select-only RLS policies on `sessions`, `session_options`, and `votes` ensure browsers cannot write directly.
- Host tokens are stored in `session_secrets`, which has RLS enabled with no anon policies **and** `REVOKE ALL … FROM anon, authenticated` as defense in depth. The anon key can never read host tokens.
