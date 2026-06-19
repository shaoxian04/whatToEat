import { test, expect } from "@playwright/test";

const SESSION = {
  session: { id: "sess-1", hostName: "Sam", status: "open", winnerOptionId: null, expiresAt: "" },
  options: [
    { id: "o1", sessionId: "sess-1", placeId: null, name: "Sushi", snapshot: null },
    { id: "o2", sessionId: "sess-1", placeId: null, name: "Pizza", snapshot: null },
  ],
  votes: [],
};

test("create a quick vote, join, and cast a ballot", async ({ page }) => {
  await page.route("**/api/sessions", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ sessionId: "sess-1", hostToken: "host-token-1" }),
    }));
  await page.route("**/api/sessions/sess-1", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SESSION),
    }));
  await page.route("**/api/sessions/sess-1/votes", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }));

  await page.goto("/vote");
  await page.getByLabel(/your name/i).fill("Sam");
  const opts = page.getByLabel(/option/i);
  await opts.nth(0).fill("Sushi");
  await opts.nth(1).fill("Pizza");
  await page.getByRole("button", { name: /start vote/i }).click();

  // Now on /vote/sess-1 — join then vote
  await expect(page.getByText(/lunch vote/i)).toBeVisible();
  await page.getByLabel(/your name/i).fill("Sam");
  await page.getByRole("button", { name: /join/i }).click();

  await expect(page.getByText("Sushi")).toBeVisible();
  await page.getByRole("button", { name: /upvote sushi/i }).click();
  // No assertion error means the cast POST was intercepted and the UI stayed responsive.
  await expect(page.getByRole("button", { name: /close voting/i })).toBeVisible();
});
