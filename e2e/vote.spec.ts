import { test, expect } from "@playwright/test";

const SESSION = {
  session: { id: "sess-1", hostName: "Sam", status: "open", winnerOptionId: null, expiresAt: "" },
  options: [
    { id: "o1", sessionId: "sess-1", placeId: null, name: "Sushi", snapshot: null },
    { id: "o2", sessionId: "sess-1", placeId: null, name: "Pizza", snapshot: null },
  ],
  votes: [],
};

test.beforeEach(async ({ page }) => {
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
});

test("host creates a vote and lands in the room with a shareable link", async ({ page }) => {
  await page.goto("/vote");
  await page.getByLabel(/your name/i).fill("Sam");
  const opts = page.getByLabel(/option/i);
  await opts.nth(0).fill("Sushi");
  await opts.nth(1).fill("Pizza");
  await page.getByRole("button", { name: /start vote/i }).click();

  // Host is taken straight into the room — no second "enter your name / join" step.
  await expect(page.getByRole("button", { name: /copy link/i })).toBeVisible();
  await expect(page.getByText("Sushi")).toBeVisible();
  await page.getByRole("button", { name: /upvote sushi/i }).click();
  // Host can close the vote (they hold the host token).
  await expect(page.getByRole("button", { name: /close voting/i })).toBeVisible();
});

test("an invited guest joins via the shared link", async ({ page }) => {
  // A guest opens the link fresh (no stored name) and sees the join screen.
  await page.goto("/vote/sess-1");
  await expect(page.getByText(/lunch vote/i)).toBeVisible();
  await page.getByLabel(/your name/i).fill("Bo");
  await page.getByRole("button", { name: /^join$/i }).click();

  await expect(page.getByText("Sushi")).toBeVisible();
  await page.getByRole("button", { name: /upvote sushi/i }).click();
});
