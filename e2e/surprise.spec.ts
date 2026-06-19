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
