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
