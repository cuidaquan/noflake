import { expect, test } from "@playwright/test";

test("organizer can create an event", async ({ page }) => {
  await page.goto("/organizer");
  await page.getByLabel("Title").fill("Builder Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText("Builder Dinner")).toBeVisible();
});

test("organizer sees share link, QR payload, and dashboard counts after creating an event", async ({
  page
}) => {
  await page.goto("/organizer");
  await page.getByLabel("Title").fill("Builder Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText("Share link")).toBeVisible();
  await expect(page.getByText("QR payload")).toBeVisible();
  await expect(page.getByText("Reserved")).toBeVisible();
});

test("organizer must provide sponsor pool for sponsor mode", async ({ page }) => {
  await page.goto("/organizer");
  await page.getByLabel("Title").fill("Sponsor Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByLabel("Settlement Mode").selectOption("SPONSOR");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText("Sponsor pool is required for sponsor mode")).toBeVisible();
});
