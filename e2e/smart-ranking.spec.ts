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
