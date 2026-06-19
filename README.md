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
