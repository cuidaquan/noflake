import { expect, test } from "@playwright/test";

test("organizer can create an event", async ({ page }) => {
  await page.goto("/organizer");
  await page.getByLabel("Title").fill("Builder Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText("Builder Dinner")).toBeVisible();
});
